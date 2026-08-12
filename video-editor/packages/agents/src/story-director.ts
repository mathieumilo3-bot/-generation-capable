import {
  newId,
  StoryBlueprintSchema,
  type BriefSpec,
  type Segment,
  type StoryBeat,
  type StoryBeatRole,
  type StoryBlueprint,
  type StyleProfile,
} from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import type { ModelRouter } from "@video-editor/model-router";
import { recordProviderCall } from "@video-editor/cost-ledger";
import { parseAndValidateJson } from "./llm-json.js";
import { z } from "zod";

function editScore(s: Segment): number {
  return s.hookPotential * 0.3 + s.energy * 0.2 + s.relevance * 0.25 + s.narrativeInterest * 0.15 + s.visualQuality * 0.1;
}

const LLM_STORY_SCHEMA = z.object({
  beats: z.array(z.object({ role: z.string(), segmentIds: z.array(z.string()) })),
});

/**
 * Agent 03 — Story Director. Chemin réel : LLM avec les segments déjà
 * scorés par l'Agent 02 (jamais le rush brut). Repli déterministe :
 * sélection gloutonne par editScore sous contrainte de budget de durée —
 * garantit un blueprint cohérent même sans LLM. Dans les deux cas, tout
 * segmentId renvoyé est revérifié contre la liste réelle : un LLM qui
 * invente un id de segment est traité comme une hallucination et rejeté,
 * jamais silencieusement toléré (§11 du brief).
 */
export async function runStoryDirector(
  db: Db,
  router: ModelRouter,
  projectId: string,
  segments: Segment[],
  brief: BriefSpec,
  styleProfile: StyleProfile,
  version: number
): Promise<StoryBlueprint> {
  if (segments.length === 0) {
    throw new Error("Aucun segment exploitable détecté dans les rushs — impossible de construire un storytelling.");
  }

  let beats: StoryBeat[] | null = null;
  if (router.capabilities.llm) {
    try {
      beats = await llmStoryBeats(db, router, projectId, segments, brief, styleProfile);
    } catch (err) {
      console.warn(`[story_director] LLM indisponible/invalide, repli heuristique: ${(err as Error).message}`);
    }
  }
  if (!beats) beats = heuristicStoryBeats(segments, brief, styleProfile);

  const usedIds = new Set(beats.flatMap((b) => b.segmentIds));
  const discardedSegmentIds = segments.map((s) => s.id).filter((id) => !usedIds.has(id));
  const discardReason: Record<string, string> = {};
  for (const id of discardedSegmentIds) discardReason[id] = "score de montage insuffisant face au budget de durée cible";

  const blueprint: StoryBlueprint = StoryBlueprintSchema.parse({
    id: newId("story"),
    projectId,
    version,
    beats,
    discardedSegmentIds,
    discardReason,
  });
  db.saveStoryBlueprint(blueprint);
  return blueprint;
}

function heuristicStoryBeats(segments: Segment[], brief: BriefSpec, styleProfile: StyleProfile): StoryBeat[] {
  const chronological = [...segments].sort((a, b) => a.start - b.start);
  const earlyCutoff = chronological[0]!.start + (chronological[chronological.length - 1]!.end - chronological[0]!.start) * 0.4;
  const earlyCandidates = chronological.filter((s) => s.start <= earlyCutoff);
  const hookPool = earlyCandidates.length > 0 ? earlyCandidates : chronological;
  const hook = [...hookPool].sort((a, b) => editScore(b) - editScore(a))[0]!;

  const remaining = chronological.filter((s) => s.id !== hook.id);
  const budgetSec = Math.max(5, brief.targetDurationSec - styleProfile.hookDuration - 2);
  const byScore = [...remaining].sort((a, b) => editScore(b) - editScore(a));

  const selected: Segment[] = [];
  let used = 0;
  for (const s of byScore) {
    const dur = Math.min(s.end - s.start, styleProfile.averageCutDuration * 1.4);
    if (used + dur > budgetSec && selected.length > 0) continue;
    selected.push(s);
    used += dur;
    if (used >= budgetSec) break;
  }
  selected.sort((a, b) => a.start - b.start);

  const beats: StoryBeat[] = [{ role: "hook", segmentIds: [hook.id] }];
  if (selected.length === 0) {
    // aucun segment supplémentaire ne rentre dans le budget : le hook seul devient tout le montage
    return beats;
  }
  const n = selected.length;
  const contextEnd = Math.max(1, Math.round(n * 0.3));
  const tensionEnd = Math.max(contextEnd, Math.round(n * 0.65));
  const proofEnd = Math.max(tensionEnd, Math.round(n * 0.85));

  const roleFor = (i: number): StoryBeatRole => {
    if (i < contextEnd) return "context";
    if (i < tensionEnd) return "development";
    if (i < proofEnd) return "proof";
    return "conclusion";
  };
  for (let i = 0; i < n; i++) {
    beats.push({ role: roleFor(i), segmentIds: [selected[i]!.id] });
  }
  if (brief.cta) {
    const conclusion = selected[n - 1]!;
    beats.push({ role: "cta", segmentIds: [conclusion.id], note: "Réutilise le dernier plan sélectionné — pas de plan CTA dédié en V1 sans génération de médias." });
  }
  return beats;
}

async function llmStoryBeats(
  db: Db,
  router: ModelRouter,
  projectId: string,
  segments: Segment[],
  brief: BriefSpec,
  styleProfile: StyleProfile
): Promise<StoryBeat[]> {
  const compactSegments = segments.map((s) => ({
    id: s.id,
    start: Math.round(s.start * 10) / 10,
    end: Math.round(s.end * 10) / 10,
    transcript: s.transcript.slice(0, 200),
    scores: {
      energy: s.energy,
      clarity: s.clarity,
      relevance: s.relevance,
      hookPotential: s.hookPotential,
      narrativeInterest: s.narrativeInterest,
    },
  }));
  const prompt = `Brief: ${JSON.stringify(brief)}\nStyle: ${JSON.stringify(styleProfile)}\nSegments disponibles (utilise UNIQUEMENT ces ids, n'en invente aucun):\n${JSON.stringify(compactSegments)}`;
  const result = await router.llm.complete({
    system: `Tu es le Story Director d'un monteur vidéo IA. Construis le storytelling à
partir des segments fournis. Réponds UNIQUEMENT avec un JSON:
{"beats":[{"role":"hook"|"context"|"development"|"tension"|"proof"|"conclusion"|"cta","segmentIds":["..."]}]}
Règles : chaque segmentId DOIT exister dans la liste fournie. La durée totale
des segments choisis doit approcher ${brief.targetDurationSec}s. Supprime les
répétitions et hésitations. Priorité : clarté, rétention, naturel.`,
    prompt,
    maxTokens: 1200,
  });
  recordProviderCall(db, { projectId, agent: "story_director", stage: "story_blueprint", result });
  const parsed = parseAndValidateJson(result.data, LLM_STORY_SCHEMA);
  const validIds = new Set(segments.map((s) => s.id));
  const beats: StoryBeat[] = [];
  for (const b of parsed.beats) {
    const ids = b.segmentIds.filter((id) => validIds.has(id));
    if (ids.length === 0) continue;
    if (ids.length !== b.segmentIds.length) {
      throw new Error(`Le modèle a référencé un segmentId inexistant (hallucination) — réponse rejetée.`);
    }
    beats.push({ role: b.role as StoryBeatRole, segmentIds: ids });
  }
  if (beats.length === 0 || !beats.some((b) => b.role === "hook")) {
    throw new Error("Réponse du modèle sans hook exploitable.");
  }
  return beats;
}

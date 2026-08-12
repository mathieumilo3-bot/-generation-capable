import {
  newId,
  validateSegmentTimestamps,
  type Rush,
  type Segment,
} from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import type { ModelRouter } from "@video-editor/model-router";
import { recordProviderCall } from "@video-editor/cost-ledger";
import { probe, detectSilence, nonSilentSegments, volumeStats, extractAudio, type SilenceWindow } from "@video-editor/render";
import { join, dirname } from "node:path";

function dbToEnergy(meanVolumeDb: number): number {
  // -45dB (quasi silence) -> 0, -5dB (fort) -> 1, clampé
  return Math.max(0, Math.min(1, (meanVolumeDb + 45) / 40));
}

function durationClarity(durationSec: number): number {
  // un segment "propre" dure typiquement entre 1.2s et 9s ; trop court ou trop long
  // suggère une coupure au milieu d'une idée — proxy grossier en l'absence de STT/vision.
  if (durationSec < 1.2) return 0.4;
  if (durationSec > 9) return 0.5;
  return 0.75;
}

function visualQualityFromResolution(width: number, height: number): number {
  const maxSide = Math.max(width, height);
  if (maxSide >= 1920) return 0.9;
  if (maxSide >= 1280) return 0.7;
  if (maxSide >= 854) return 0.55;
  return 0.4;
}

export interface RushTranscript {
  words: { word: string; start: number; end: number }[];
}

/**
 * Étape "transcription" du pipeline (§8 du brief), isolée de l'analyse
 * pour que la progression réelle affichée à l'utilisateur corresponde à
 * une étape effectivement distincte, pas un libellé cosmétique. Retourne
 * un transcript vide (jamais un texte inventé) si aucune clé STT n'est
 * configurée ou si le rush n'a pas de piste audio.
 */
export async function transcribeRush(db: Db, router: ModelRouter, projectId: string, rush: Rush): Promise<RushTranscript> {
  const analysisSource = rush.proxyPath ?? rush.storagePath;
  if (!router.capabilities.stt) return { words: [] };
  const info = await probe(analysisSource);
  if (!info.hasAudio) return { words: [] };
  try {
    const audioPath = join(dirname(analysisSource), `${rush.id}_audio.mp3`);
    await extractAudio(analysisSource, audioPath);
    const result = await router.stt.transcribe(audioPath);
    recordProviderCall(db, { projectId, agent: "video_analyzer", stage: "transcription", result });
    return { words: result.data.words };
  } catch (err) {
    console.warn(`[transcription] STT indisponible pour ${rush.id}: ${(err as Error).message}`);
    return { words: [] };
  }
}

/**
 * Agent 02 — Video Analyzer. Le socle déterministe (détection de silence
 * + niveau audio + résolution) tourne TOUJOURS, sans aucune clé API — ce
 * n'est pas un stub qui bloque le pipeline, c'est une vraie analyse basée
 * sur ffmpeg (§22 du brief). Le transcript (déjà produit par
 * transcribeRush) et la notation sémantique (LLM texte) s'ajoutent
 * par-dessus quand les clés sont présentes, sans changer le contrat de
 * sortie.
 */
export async function runVideoAnalyzer(
  db: Db,
  router: ModelRouter,
  projectId: string,
  rush: Rush,
  transcript: RushTranscript
): Promise<Segment[]> {
  const analysisSource = rush.proxyPath ?? rush.storagePath;
  const info = await probe(analysisSource);

  const silences = await detectSilence(analysisSource, { noiseDb: -32, minSilenceDurationSec: 0.45 });
  const windows = nonSilentSegments(info.durationSec, silences);
  const visualQuality = visualQualityFromResolution(info.width, info.height);

  const segments: Segment[] = [];
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]!;
    const vol = await volumeStats(analysisSource, w).catch(() => ({ meanVolumeDb: -30, maxVolumeDb: -20 }));
    const energy = dbToEnergy(vol.meanVolumeDb);
    const clarity = durationClarity(w.end - w.start);
    const segTranscript = transcript.words
      .filter((word) => word.start >= w.start && word.end <= w.end)
      .map((word) => word.word)
      .join(" ");

    const earlyBonus = i < 3 ? (0.15 * (3 - i)) / 3 : 0;
    const hookPotential = Math.max(0, Math.min(1, energy * 0.7 + earlyBonus));

    let relevance = clarity * 0.5 + energy * 0.5;
    let narrativeInterest = clarity * 0.4 + energy * 0.3 + visualQuality * 0.3;

    if (router.capabilities.llm && segTranscript.trim().length > 0) {
      try {
        const scored = await scoreTranscriptWithLlm(db, router, projectId, segTranscript);
        relevance = scored.relevance;
        narrativeInterest = scored.narrativeInterest;
      } catch (err) {
        console.warn(`[video_analyzer] scoring LLM texte échoué, heuristique conservée: ${(err as Error).message}`);
      }
    }

    const segment: Segment = {
      id: newId("seg"),
      rushId: rush.id,
      projectId,
      start: w.start,
      end: w.end,
      transcript: segTranscript,
      energy,
      clarity,
      relevance,
      hookPotential,
      visualQuality,
      narrativeInterest,
    };
    validateSegmentTimestamps(segment, info.durationSec);
    segments.push(segment);
  }
  return segments;
}

async function scoreTranscriptWithLlm(
  db: Db,
  router: ModelRouter,
  projectId: string,
  transcript: string
): Promise<{ relevance: number; narrativeInterest: number }> {
  const result = await router.llm.complete({
    system: `Tu notes un segment de transcript sur deux critères, entre 0 et 1 : "relevance"
(pertinence pour un montage vidéo) et "narrativeInterest" (intérêt narratif/storytelling).
Réponds UNIQUEMENT avec {"relevance": number, "narrativeInterest": number}.`,
    prompt: transcript.slice(0, 500),
    maxTokens: 100,
  });
  recordProviderCall(db, { projectId, agent: "video_analyzer", stage: "video_analysis", result });
  const parsed = JSON.parse(result.data.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
    relevance?: number;
    narrativeInterest?: number;
  };
  return {
    relevance: clamp01(parsed.relevance ?? 0.5),
    narrativeInterest: clamp01(parsed.narrativeInterest ?? 0.5),
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export type { SilenceWindow };

import {
  newId,
  QC_PASS_THRESHOLD,
  type BriefSpec,
  type CorrectionInstruction,
  type EditBlueprint,
  type QcReport,
  type QcScores,
  type Segment,
  type StyleProfile,
} from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import type { CreativeReview } from "./creative-director.js";

/**
 * Agent 09 — Quality Control. Scoring déterministe (§18 du brief : "le
 * score humain doit être la référence finale, le score IA n'est qu'un
 * outil de contrôle" — donc pas besoin d'un jugement LLM coûteux ici
 * pour un score utile ; un futur passage vision/LLM peut s'ajouter en
 * complément sans remplacer ce socle). Une seule correction automatique
 * au maximum (§5 Agent 09 du brief) — jamais de boucle.
 */
export function runQualityControl(
  db: Db,
  renderId: string,
  projectId: string,
  editBlueprint: EditBlueprint,
  segmentsById: Map<string, Segment>,
  styleProfile: StyleProfile,
  brief: BriefSpec,
  creativeReview: CreativeReview
): QcReport {
  const hookClip = editBlueprint.clips.find((c) => c.role === "hook");
  const hookSegment = hookClip ? segmentsById.get(hookClip.segmentId) : undefined;
  let hook = hookSegment ? hookSegment.hookPotential * 100 : 0;
  if (hookClip && Math.abs(hookClip.outDuration - styleProfile.hookDuration) > styleProfile.hookDuration * 0.8) {
    hook = Math.max(0, hook - 15);
  }

  const roles = new Set(editBlueprint.clips.map((c) => c.role));
  let story = 100;
  if (!roles.has("hook")) story -= 40;
  if (!roles.has("conclusion") && !roles.has("cta")) story -= 20;
  story = Math.max(0, story);

  const avgClipDuration =
    editBlueprint.clips.reduce((sum, c) => sum + c.outDuration, 0) / Math.max(1, editBlueprint.clips.length);
  const rhythmDelta = Math.abs(avgClipDuration - styleProfile.averageCutDuration) / styleProfile.averageCutDuration;
  const rhythm = Math.max(0, 100 - Math.min(100, rhythmDelta * 100));

  const visual =
    (editBlueprint.clips.reduce((sum, c) => sum + (segmentsById.get(c.segmentId)?.visualQuality ?? 0.5), 0) /
      Math.max(1, editBlueprint.clips.length)) *
    100;

  let captions = 20;
  let captionsNote = "Sous-titres indisponibles (transcription non configurée ou vide).";
  if (editBlueprint.captions.length > 0) {
    const coveredSec = editBlueprint.captions.reduce((sum, c) => sum + (c.timelineEnd - c.timelineStart), 0);
    captions = Math.max(0, Math.min(100, (coveredSec / Math.max(1, editBlueprint.totalDurationSec)) * 100));
    captionsNote = "";
  }

  const sound = editBlueprint.music ? 90 : 55;

  let broll = 100;
  if (editBlueprint.brollSlots.length > 0) {
    const resolved = editBlueprint.brollSlots.filter((s) => s.resolvedSource !== null).length;
    broll = (resolved / editBlueprint.brollSlots.length) * 100;
  }

  const coherence = Math.max(30, (creativeReview.ok ? 90 : 55) - Math.max(0, creativeReview.notes.length - 1) * 5);
  const styleMatch = (rhythm + visual + broll + captions) / 4;

  const scores: QcScores = {
    hook: round(hook),
    story: round(story),
    rhythm: round(rhythm),
    visual: round(visual),
    captions: round(captions),
    sound: round(sound),
    broll: round(broll),
    coherence: round(coherence),
    styleMatch: round(styleMatch),
    overall: round((hook + story + rhythm + visual + captions + sound + broll + coherence + styleMatch) / 9),
  };

  const corrections: CorrectionInstruction[] = [];
  if (scores.overall < QC_PASS_THRESHOLD) {
    const correctable: { key: keyof QcScores; targetAgent: CorrectionInstruction["targetAgent"]; instruction: string }[] = [
      { key: "rhythm", targetAgent: "editor", instruction: "Resserrer les durées de plan vers la moyenne du style demandé." },
      {
        key: "captions",
        targetAgent: "caption_director",
        instruction: captionsNote || "Améliorer la couverture des sous-titres sur la timeline.",
      },
      { key: "sound", targetAgent: "sound_designer", instruction: "Sélectionner une piste musicale correspondant à l'intensité demandée." },
      { key: "broll", targetAgent: "broll_director", instruction: "Élargir la recherche de médias stock correspondant aux besoins de B-roll." },
    ];
    const worst = correctable.sort((a, b) => scores[a.key] - scores[b.key])[0]!;
    corrections.push({ targetAgent: worst.targetAgent, instruction: worst.instruction, reason: `${worst.key} = ${scores[worst.key]}/100, sous le seuil de ${QC_PASS_THRESHOLD}` });
  }

  const report: QcReport = {
    id: newId("qc"),
    renderId,
    projectId,
    scores,
    corrections,
    passed: scores.overall >= QC_PASS_THRESHOLD,
    threshold: QC_PASS_THRESHOLD,
    createdAt: new Date().toISOString(),
  };
  db.saveQcReport(report);
  return report;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

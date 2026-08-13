/**
 * Poids de progression par étape du pipeline (§9 du brief factory).
 *
 * La progression globale n'est PAS "index d'étape / nombre d'étapes" —
 * ce serait mentir (un montage passe 60% de son temps dans les deux
 * rendus, 3% dans l'upload). Chaque étape a un poids reflétant son coût
 * réel typique ; la somme fait 100. La barre avance donc proportion-
 * nellement au travail réellement abattu, pas au nombre d'étiquettes
 * cochées — c'est ce qui évite le "faux 88% bloqué".
 */

import type { PipelineStage } from "./pipeline-stage.js";
import { PIPELINE_STAGES } from "./pipeline-stage.js";
import type { RenderJobStatus } from "./render-queue.js";

export const STAGE_WEIGHTS: Record<PipelineStage, number> = {
  upload: 1,
  storage: 1,
  proxy_generation: 8,
  transcription: 8,
  video_analysis: 10,
  style_analysis: 3,
  brief_analysis: 3,
  story_blueprint: 4,
  edit_blueprint: 2,
  broll: 2,
  captions: 2,
  sound: 3,
  creative_review: 2,
  proxy_render: 18,
  quality_control: 3,
  correction: 5,
  final_render: 23,
  delivery: 2,
};

/** Mappe une étape de pipeline vers le statut de queue correspondant (§2). */
export const STAGE_TO_JOB_STATUS: Record<PipelineStage, RenderJobStatus> = {
  upload: "preparing",
  storage: "preparing",
  proxy_generation: "preparing",
  transcription: "analyzing",
  video_analysis: "analyzing",
  style_analysis: "analyzing",
  brief_analysis: "analyzing",
  story_blueprint: "processing",
  edit_blueprint: "processing",
  broll: "processing",
  captions: "processing",
  sound: "processing",
  creative_review: "processing",
  proxy_render: "rendering",
  quality_control: "checking",
  correction: "rendering",
  final_render: "encoding",
  delivery: "checking",
};

const TOTAL_WEIGHT = PIPELINE_STAGES.reduce((sum, s) => sum + STAGE_WEIGHTS[s], 0);

/**
 * Progression cumulée (0-100) une fois `completedStages` terminées.
 * On compte le poids des étapes terminées + la moitié du poids de l'étape
 * en cours (elle a commencé mais n'est pas finie) pour une barre qui ne
 * reste jamais figée pendant une étape longue.
 */
export function computeProgress(completedStages: Set<PipelineStage>, currentStage?: PipelineStage): number {
  let done = 0;
  for (const s of PIPELINE_STAGES) {
    if (completedStages.has(s)) done += STAGE_WEIGHTS[s];
  }
  if (currentStage && !completedStages.has(currentStage)) {
    done += STAGE_WEIGHTS[currentStage] * 0.5;
  }
  return Math.min(100, Math.round((done / TOTAL_WEIGHT) * 100));
}

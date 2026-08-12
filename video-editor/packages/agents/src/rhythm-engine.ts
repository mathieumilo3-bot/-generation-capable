import type { StyleProfile, StoryBeatRole } from "@video-editor/shared-types";

/**
 * Couche déterministe de rythme — le cœur stratégique de l'Editor Agent
 * (§5 Agent 04, §22 règle absolue du brief produit). Aucune fonction ici
 * n'appelle un LLM : étant donné un style profile et l'intention narrative
 * déjà décidée par le Story Director, ces règles calculent des paramètres
 * de montage reproductibles et testables. C'est délibéré — un LLM est
 * mauvais pour décider un timing à la frame près, et le faire deviendrait
 * la principale source d'un montage qui "sent l'IA" (voir §01 du dossier
 * stratégique : le rythme est le vrai risque R&D du projet).
 */

const ROLE_DURATION_FACTOR: Record<StoryBeatRole, number> = {
  hook: 0.85, // le hook est toujours plus court que le rythme moyen — crée l'urgence
  context: 1.1,
  development: 1.0,
  tension: 0.9,
  proof: 1.0,
  conclusion: 1.05,
  cta: 0.8,
};

export function computeClipOutDuration(args: {
  role: StoryBeatRole;
  segmentDurationSec: number;
  styleProfile: StyleProfile;
}): number {
  const { role, segmentDurationSec, styleProfile } = args;
  const target = role === "hook" ? styleProfile.hookDuration : styleProfile.averageCutDuration * ROLE_DURATION_FACTOR[role];
  // jamais plus long que le segment source réellement disponible, jamais en dessous de 0.6s (imperceptible sinon)
  return Math.max(0.6, Math.min(target, segmentDurationSec));
}

/**
 * Décide déterministiquement quels indices de clip reçoivent un zoom,
 * pour approximer `zoomFrequency` sur l'ensemble de la timeline — un
 * espacement régulier plutôt qu'un tirage aléatoire, pour rester
 * reproductible (même blueprint en entrée ⇒ même sortie en sortie,
 * indispensable pour déboguer et pour le test de validation du §17).
 */
export function planZoomIndices(clipCount: number, zoomFrequency: number): Set<number> {
  const indices = new Set<number>();
  if (zoomFrequency <= 0 || clipCount === 0) return indices;
  const step = Math.max(1, Math.round(1 / Math.min(zoomFrequency, 1)));
  for (let i = 1; i < clipCount; i += step) indices.add(i); // jamais sur le tout premier plan (le hook doit respirer avant le premier zoom)
  return indices;
}

export function zoomScaleForRole(role: StoryBeatRole): number {
  return role === "hook" || role === "tension" ? 1.25 : 1.12;
}

export type TransitionKind = "hard_cut" | "soft_fade" | "whip_pan";

export function transitionForClip(index: number, styleProfile: StyleProfile): TransitionKind {
  if (index === 0) return "hard_cut"; // toujours un hard cut à l'entrée du hook
  if (styleProfile.transitionStyle === "mixed") return index % 3 === 0 ? "whip_pan" : "hard_cut";
  return styleProfile.transitionStyle as TransitionKind;
}

/**
 * Décide quels indices de plan méritent un slot B-roll, pour approximer
 * `brollDensity`. Favorise les plans à faible qualité visuelle ou faible
 * intérêt narratif — heuristique MVP pour "quand je parle d'un concept"
 * en l'absence d'une compréhension sémantique plus fine (§6 du brief : ce
 * raffinement attend une vraie couche vision/LLM branchée).
 */
export function planBrollIndices(
  clipScores: { visualQuality: number; narrativeInterest: number }[],
  brollDensity: number
): number[] {
  const count = Math.round(clipScores.length * brollDensity);
  if (count <= 0) return [];
  return clipScores
    .map((s, i) => ({ i, weakness: 1 - (s.visualQuality * 0.5 + s.narrativeInterest * 0.5) }))
    .filter((s) => s.i !== 0) // jamais couper le hook avec du B-roll
    .sort((a, b) => b.weakness - a.weakness)
    .slice(0, count)
    .map((s) => s.i)
    .sort((a, b) => a - b);
}

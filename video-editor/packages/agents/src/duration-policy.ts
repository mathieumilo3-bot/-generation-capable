import type { BriefSpec, Segment } from "@video-editor/shared-types";

/**
 * POLITIQUE DE DURÉE (§3, §24 du brief lead-editor).
 *
 * Règle absolue : on n'invente JAMAIS une durée arbitraire (le fameux 45s
 * codé en dur est banni). Si l'utilisateur ne demande pas de durée, on la
 * DÉRIVE du contenu réellement exploitable — et on ne dépasse jamais la
 * durée du contenu disponible (pas de remplissage, pas de boucle, pas de
 * duplication).
 *
 * - durée explicite  → on la respecte (bornée par le contenu : on ne
 *                       fabrique pas de vidéo plus longue que les rushs) ;
 * - pas de durée      → dérivée = contenu utile, plafonnée pour le
 *                       short-form (une vidéo de 12s reste 12s, pas 45s) ;
 * - source < cible    → on n'invente pas de contenu ;
 * - source > cible    → on sélectionnera (géré par le Story Director).
 */

const USABLE_VISUAL_THRESHOLD = 0.3;
/** Plafond indicatif du short-form vertical (au-delà, on sélectionne). */
const SHORT_FORM_CAP_SEC = 60;

function isShortFormPlatform(platform: string): boolean {
  return /tiktok|reels|shorts|vertical/i.test(platform);
}

/** Somme des durées des segments réellement exploitables (dead air déjà exclu en amont). */
export function usableContentDurationSec(segments: Pick<Segment, "start" | "end" | "visualQuality">[]): number {
  const usable = segments.filter((s) => s.visualQuality >= USABLE_VISUAL_THRESHOLD);
  const pool = usable.length > 0 ? usable : segments;
  return pool.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
}

export interface DurationDecision {
  targetSec: number;
  explicit: boolean;
  reason: string;
}

/**
 * Détermine la durée éditoriale cible. `explicit` distingue une durée
 * réellement demandée d'une durée dérivée — utile pour l'observabilité.
 */
export function resolveTargetDurationSec(
  brief: Pick<BriefSpec, "platform" | "targetDurationSec">,
  segments: Pick<Segment, "start" | "end" | "visualQuality">[]
): DurationDecision {
  const content = usableContentDurationSec(segments);

  if (brief.targetDurationSec != null) {
    // Durée demandée respectée, mais JAMAIS au-delà du contenu disponible
    // (on ne rallonge pas artificiellement une source trop courte).
    const capped = content > 0 ? Math.min(brief.targetDurationSec, content) : brief.targetDurationSec;
    const note = capped < brief.targetDurationSec ? ` (ramenée à ${capped.toFixed(1)}s : contenu limité)` : "";
    return { targetSec: round1(capped), explicit: true, reason: `durée demandée ${brief.targetDurationSec}s${note}` };
  }

  // Aucune durée demandée → dérivée du contenu utile.
  const cap = isShortFormPlatform(brief.platform) ? SHORT_FORM_CAP_SEC : Number.POSITIVE_INFINITY;
  const target = Math.max(3, Math.min(content, cap));
  const capNote = isShortFormPlatform(brief.platform) && content > cap ? `, plafond short-form ${cap}s` : "";
  return {
    targetSec: round1(target),
    explicit: false,
    reason: `dérivée du contenu (${content.toFixed(1)}s utile${capNote}) — aucune durée demandée`,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

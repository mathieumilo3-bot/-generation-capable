import type { BriefSpec, Segment } from "@video-editor/shared-types";

/**
 * POLITIQUE DE DURÉE (§3, §24 du brief lead-editor).
 *
 * Règle absolue n°1 : on n'invente JAMAIS une durée arbitraire (le fameux
 * 45s codé en dur est banni).
 *
 * Règle absolue n°2 : AUCUN plafond de plateforme codé en dur (pas de
 * "60s max pour TikTok"). Un monteur professionnel ne raisonne pas en
 * limite de durée par plateforme — certains formats courts font 20s,
 * d'autres 7 minutes, selon ce que le contenu justifie. Toute limite
 * artificielle ici serait exactement le même problème que le 45s : une
 * valeur inventée qui ne vient pas d'une vraie décision éditoriale.
 *
 * - durée explicite  → RESPECTÉE, toujours. La seule limite physique est
 *                       qu'on ne fabrique pas de contenu qui n'existe pas
 *                       (pas de repeat/boucle/freeze pour combler) ; si le
 *                       contenu utile est plus court que la demande, on le
 *                       dit explicitement plutôt que de tricher.
 * - pas de durée      → dérivée intégralement du contenu utile réel,
 *                       sans aucun plafond. Sur 7 minutes de rushs
 *                       exploitables, une dérivée peut faire 7 minutes.
 * - source < cible    → on n'invente pas de contenu, on le signale.
 * - source > cible    → sélection éditoriale (Story Director).
 */

const USABLE_VISUAL_THRESHOLD = 0.3;

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
  /** true si la demande explicite dépassait le contenu réellement disponible. */
  contentInsufficient: boolean;
}

/**
 * Détermine la durée éditoriale cible. `explicit` distingue une durée
 * réellement demandée d'une durée dérivée — utile pour l'observabilité.
 * Aucun plafond arbitraire n'est appliqué dans les deux cas.
 */
export function resolveTargetDurationSec(
  brief: Pick<BriefSpec, "platform" | "targetDurationSec">,
  segments: Pick<Segment, "start" | "end" | "visualQuality">[]
): DurationDecision {
  const content = usableContentDurationSec(segments);

  if (brief.targetDurationSec != null) {
    // Durée demandée TOUJOURS respectée. Seule exception : on ne fabrique
    // jamais de contenu inexistant (pas de boucle/freeze) — si le contenu
    // utile est réellement insuffisant, on le signale plutôt que de
    // tricher, mais on ne rogne pas silencieusement une demande légitime.
    const insufficient = content > 0 && content < brief.targetDurationSec;
    const note = insufficient
      ? ` (contenu utile disponible: ${content.toFixed(1)}s — voir avertissement)`
      : "";
    return {
      targetSec: round1(brief.targetDurationSec),
      explicit: true,
      reason: `durée demandée ${brief.targetDurationSec}s${note}`,
      contentInsufficient: insufficient,
    };
  }

  // Aucune durée demandée → dérivée intégralement du contenu utile, SANS
  // AUCUN PLAFOND. Le Story Director décide ensuite, sur cette base, ce
  // qui mérite réellement d'être gardé (c'est lui qui raccourcit par
  // sélection éditoriale, pas une limite de plateforme arbitraire ici).
  const target = Math.max(3, content);
  return {
    targetSec: round1(target),
    explicit: false,
    reason: `dérivée du contenu (${content.toFixed(1)}s utile, aucun plafond appliqué) — aucune durée demandée`,
    contentInsufficient: false,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

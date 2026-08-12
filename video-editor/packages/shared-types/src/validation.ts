import type { Segment } from "./project.js";
import type { TimelineClip } from "./blueprint.js";

export class TimestampOutOfBoundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimestampOutOfBoundsError";
  }
}

/**
 * Garde-fou obligatoire (§5 Agent 02 et §11 du brief : "ne laisse jamais
 * un LLM inventer des timestamps"). Un LLM ne doit jamais être cru sur
 * parole pour une coordonnée temporelle — on la revérifie systématiquement
 * contre la durée réelle du média mesurée par ffprobe. Lève une erreur
 * plutôt que de silencieusement clamper : un timestamp hors bornes est un
 * signal qu'il faut rejeter la sortie de l'agent, pas la corriger en douce.
 */
export function validateSegmentTimestamps(segment: Segment, mediaDurationSec: number): void {
  if (segment.start < 0) {
    throw new TimestampOutOfBoundsError(
      `Segment ${segment.id}: start (${segment.start}s) négatif.`
    );
  }
  if (segment.end <= segment.start) {
    throw new TimestampOutOfBoundsError(
      `Segment ${segment.id}: end (${segment.end}s) <= start (${segment.start}s).`
    );
  }
  if (segment.end > mediaDurationSec + 0.25) {
    // tolérance de 250ms pour l'imprécision d'encodage/probe
    throw new TimestampOutOfBoundsError(
      `Segment ${segment.id}: end (${segment.end}s) dépasse la durée réelle du rush (${mediaDurationSec}s).`
    );
  }
}

export function validateTimelineClipAgainstSegment(clip: TimelineClip, segment: Segment): void {
  if (clip.sourceStart < segment.start - 0.05 || clip.sourceEnd > segment.end + 0.05) {
    throw new TimestampOutOfBoundsError(
      `Clip ${clip.id}: [${clip.sourceStart}, ${clip.sourceEnd}] déborde du segment source ${segment.id} [${segment.start}, ${segment.end}].`
    );
  }
}

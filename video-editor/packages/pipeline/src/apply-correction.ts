import type { CorrectionInstruction, EditBlueprint, Segment, StyleProfile } from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import { runCaptionDirector, runSoundDesigner, runBrollDirector } from "@video-editor/agents";

/**
 * Applique LA correction unique décidée par le QC (§5 Agent 09 : maximum
 * une correction automatique). Chaque cas est une transformation
 * déterministe ciblée — jamais un nouvel appel LLM généraliste, pour
 * rester rapide et prévisible dans la boucle de correction.
 */
type Transcripts = Parameters<typeof runCaptionDirector>[3];

export function applyCorrection(
  db: Db,
  blueprint: EditBlueprint,
  correction: CorrectionInstruction,
  styleProfile: StyleProfile,
  segmentsById: Map<string, Segment>,
  /** Timestamps STT réels : sans eux, les sous-titres régénérés seraient approximatifs. */
  transcripts?: Transcripts
): { blueprint: EditBlueprint; musicFilePath: string | null } {
  switch (correction.targetAgent) {
    case "editor": {
      // Les plans changent de durée/position : les sous-titres doivent suivre.
      const tightened = tightenRhythm(blueprint, styleProfile, segmentsById);
      return { blueprint: runCaptionDirector(tightened, segmentsById, styleProfile, transcripts), musicFilePath: null };
    }
    case "caption_director":
      return { blueprint: runCaptionDirector(blueprint, segmentsById, styleProfile, transcripts), musicFilePath: null };
    case "sound_designer": {
      const result = runSoundDesigner(db, blueprint, styleProfile);
      return { blueprint: result.editBlueprint, musicFilePath: result.musicFilePath };
    }
    case "broll_director":
      return { blueprint: runBrollDirector(db, blueprint), musicFilePath: null };
    default:
      return { blueprint, musicFilePath: null };
  }
}

function tightenRhythm(blueprint: EditBlueprint, styleProfile: StyleProfile, segmentsById: Map<string, Segment>): EditBlueprint {
  let cursor = 0;
  const clips = blueprint.clips.map((clip) => {
    const segment = segmentsById.get(clip.segmentId);
    // Un plan parlé n'est jamais raccourci : ce serait couper la phrase en plein mot.
    if (segment?.transcript.trim()) {
      const kept = { ...clip, timelineStart: cursor };
      cursor += clip.outDuration;
      return kept;
    }
    const maxAvailable = segment ? segment.end - clip.sourceStart : clip.outDuration;
    const target = clip.role === "hook" ? styleProfile.hookDuration : styleProfile.averageCutDuration;
    const outDuration = Math.max(0.6, Math.min(target, maxAvailable));
    const updated = { ...clip, outDuration, sourceEnd: clip.sourceStart + outDuration, timelineStart: cursor };
    cursor += outDuration;
    return updated;
  });
  return { ...blueprint, clips, totalDurationSec: cursor };
}

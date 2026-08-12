import type { CorrectionInstruction, EditBlueprint, Segment, StyleProfile } from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import { runCaptionDirector, runSoundDesigner, runBrollDirector } from "@video-editor/agents";

/**
 * Applique LA correction unique décidée par le QC (§5 Agent 09 : maximum
 * une correction automatique). Chaque cas est une transformation
 * déterministe ciblée — jamais un nouvel appel LLM généraliste, pour
 * rester rapide et prévisible dans la boucle de correction.
 */
export function applyCorrection(
  db: Db,
  blueprint: EditBlueprint,
  correction: CorrectionInstruction,
  styleProfile: StyleProfile,
  segmentsById: Map<string, Segment>
): { blueprint: EditBlueprint; musicFilePath: string | null } {
  switch (correction.targetAgent) {
    case "editor":
      return { blueprint: tightenRhythm(blueprint, styleProfile, segmentsById), musicFilePath: null };
    case "caption_director":
      return { blueprint: runCaptionDirector(blueprint, segmentsById, styleProfile), musicFilePath: null };
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
    const maxAvailable = segment ? segment.end - clip.sourceStart : clip.outDuration;
    const target = clip.role === "hook" ? styleProfile.hookDuration : styleProfile.averageCutDuration;
    const outDuration = Math.max(0.6, Math.min(target, maxAvailable));
    const updated = { ...clip, outDuration, sourceEnd: clip.sourceStart + outDuration, timelineStart: cursor };
    cursor += outDuration;
    return updated;
  });
  return { ...blueprint, clips, totalDurationSec: cursor };
}

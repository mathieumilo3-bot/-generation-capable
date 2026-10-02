import { z } from "zod";

/**
 * Sortie de l'Agent 03 (Story Director) : la structure narrative, avant
 * toute décision de timing exécutable. Chaque beat référence des
 * segments déjà validés par l'Agent 02 (jamais un timestamp inventé ici).
 */
export const StoryBeatRoleSchema = z.enum([
  "hook",
  "context",
  "development",
  "tension",
  "proof",
  "conclusion",
  "cta",
]);
export type StoryBeatRole = z.infer<typeof StoryBeatRoleSchema>;

export const StoryBeatSchema = z.object({
  role: StoryBeatRoleSchema,
  segmentIds: z.array(z.string()).min(1),
  note: z.string().optional(),
});
export type StoryBeat = z.infer<typeof StoryBeatSchema>;

export const StoryBlueprintSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  version: z.number().int().positive(),
  beats: z.array(StoryBeatSchema).min(1),
  discardedSegmentIds: z.array(z.string()).default([]),
  discardReason: z.record(z.string(), z.string()).default({}),
});
export type StoryBlueprint = z.infer<typeof StoryBlueprintSchema>;

/**
 * Sortie de l'Agent 04 (Editor) : la timeline exécutable. C'est le
 * contrat entre l'intelligence (agents) et l'exécution (FFmpeg +
 * Remotion, packages/render). Le LLM décide l'intention (via le
 * StoryBlueprint) ; TOUT paramètre de timing ci-dessous — outDuration,
 * transform, transitions — est calculé par la couche déterministe de
 * rythme (packages/agents/src/rhythm-engine.ts), jamais par un appel LLM
 * libre. Voir §5 (Agent 04) et §22 (règle absolue) du brief produit.
 */
export const ZoomKeyframeSchema = z.object({
  atSec: z.number().nonnegative(), // relatif au début du clip dans la timeline finale
  scale: z.number().min(1).max(2.5),
  focusX: z.number().min(0).max(1).default(0.5),
  focusY: z.number().min(0).max(1).default(0.5),
});
export type ZoomKeyframe = z.infer<typeof ZoomKeyframeSchema>;

export const TransitionSchema = z.enum(["hard_cut", "soft_fade", "whip_pan"]);

export const TimelineClipSchema = z.object({
  id: z.string(),
  segmentId: z.string(),
  rushId: z.string(),
  sourceStart: z.number().nonnegative(),
  sourceEnd: z.number().positive(),
  timelineStart: z.number().nonnegative(),
  outDuration: z.number().positive(),
  zoomKeyframes: z.array(ZoomKeyframeSchema).default([]),
  transitionIn: TransitionSchema,
  role: StoryBeatRoleSchema,
});
export type TimelineClip = z.infer<typeof TimelineClipSchema>;

export const BrollSlotSchema = z.object({
  id: z.string(),
  afterClipId: z.string(),
  timelineStart: z.number().nonnegative(),
  durationSec: z.number().positive(),
  query: z.string(),
  resolvedSource: z.enum(["user_media", "stock", "generated"]).nullable().default(null),
  resolvedMediaId: z.string().nullable().default(null),
});
export type BrollSlot = z.infer<typeof BrollSlotSchema>;

export const CaptionWordSchema = z.object({
  word: z.string(),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  emphasize: z.boolean().default(false),
});

export const CaptionCueSchema = z.object({
  id: z.string(),
  timelineStart: z.number().nonnegative(),
  timelineEnd: z.number().positive(),
  text: z.string(),
  words: z.array(CaptionWordSchema),
});
export type CaptionCue = z.infer<typeof CaptionCueSchema>;

export const MusicTrackSchema = z.object({
  trackId: z.string(),
  source: z.enum(["stock_library", "generated"]),
  title: z.string(),
  volumeDb: z.number(),
  duckingEnabled: z.boolean().default(true),
});
export type MusicTrack = z.infer<typeof MusicTrackSchema>;

export const EditBlueprintSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  storyBlueprintId: z.string(),
  version: z.number().int().positive(),
  styleProfileId: z.string(),
  clips: z.array(TimelineClipSchema).min(1),
  brollSlots: z.array(BrollSlotSchema).default([]),
  captions: z.array(CaptionCueSchema).default([]),
  music: MusicTrackSchema.nullable().default(null),
  totalDurationSec: z.number().positive(),
});
export type EditBlueprint = z.infer<typeof EditBlueprintSchema>;

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

export const EffectTypeSchema = z.enum([
  "zoom",
  "color_grade",
  "shake",
  "blur",
  "vignette",
  "speed_ramp",
  "flash",
  "dip_to_black",
  "slide",
]);
export type EffectType = z.infer<typeof EffectTypeSchema>;

export const EffectSpecSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("zoom"),
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
    keyframes: z.array(ZoomKeyframeSchema).min(1),
  }),
  z.object({
    type: z.literal("color_grade"),
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
    saturation: z.number().min(-1).max(2).default(1),
    brightness: z.number().min(-1).max(1).default(0),
  }),
  z.object({
    type: z.literal("shake"),
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
    intensity: z.number().min(0).max(10).default(2),
    frequency: z.number().min(1).max(30).default(8),
  }),
  z.object({
    type: z.literal("blur"),
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
    radius: z.number().min(0).max(50).default(5),
  }),
  z.object({
    type: z.literal("vignette"),
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
    intensity: z.number().min(0).max(1).default(0.5),
  }),
  z.object({
    type: z.literal("speed_ramp"),
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
    startSpeed: z.number().min(0.1).max(3).default(1),
    endSpeed: z.number().min(0.1).max(3).default(1),
  }),
  z.object({
    type: z.literal("flash"),
    startSec: z.number().nonnegative(),
    durationSec: z.number().positive().default(0.1),
    intensity: z.number().min(0).max(1).default(0.8),
  }),
  z.object({
    type: z.literal("dip_to_black"),
    startSec: z.number().nonnegative(),
    durationSec: z.number().positive().default(0.3),
  }),
  z.object({
    type: z.literal("slide"),
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
    direction: z.enum(["left", "right", "up", "down"]).default("left"),
    distance: z.number().min(0).max(1).default(0.2),
  }),
]);
export type EffectSpec = z.infer<typeof EffectSpecSchema>;

export const TimelineClipSchema = z.object({
  id: z.string(),
  segmentId: z.string(),
  rushId: z.string(),
  sourceStart: z.number().nonnegative(),
  sourceEnd: z.number().positive(),
  timelineStart: z.number().nonnegative(),
  outDuration: z.number().positive(),
  zoomKeyframes: z.array(ZoomKeyframeSchema).default([]),
  effects: z.array(EffectSpecSchema).default([]),
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

export const AudioProcessingSchema = z.object({
  voiceIsolation: z.boolean().default(false),
  eq: z.boolean().default(false),
  compression: z.boolean().default(false),
  deEsser: z.boolean().default(false),
  loudnessTarget: z.number().default(-16),
  musicDucking: z.boolean().default(true),
});
export type AudioProcessing = z.infer<typeof AudioProcessingSchema>;

export const MotionLayerSchema = z.object({
  id: z.string(),
  type: z.enum(["text_overlay", "graphic", "watermark"]),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  content: z.string(),
});
export type MotionLayer = z.infer<typeof MotionLayerSchema>;

export const SfxSchema = z.object({
  id: z.string(),
  type: z.enum(["transition", "impact", "background", "voiceover_accent"]),
  startSec: z.number().nonnegative(),
  durationSec: z.number().positive(),
  volumeDb: z.number().default(-12),
});
export type Sfx = z.infer<typeof SfxSchema>;

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
  sfx: z.array(SfxSchema).default([]),
  motionLayers: z.array(MotionLayerSchema).default([]),
  audioProcessing: AudioProcessingSchema.default({}),
  totalDurationSec: z.number().positive(),
  requestedDurationSec: z.number().nullable().default(null),
});
export type EditBlueprint = z.infer<typeof EditBlueprintSchema>;

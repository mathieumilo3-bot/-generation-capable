import { z } from "zod";

export type RenderKind = "proxy" | "final";
export type RenderStatus = "queued" | "rendering" | "done" | "failed";

export interface RenderVersion {
  id: string;
  projectId: string;
  editBlueprintId: string;
  editBlueprintVersion: number;
  kind: RenderKind;
  status: RenderStatus;
  filePath?: string;
  durationMs?: number;
  error?: string;
  createdAt: string;
}

/** Les 9 critères du §17/§18 du brief — le score humain reste la référence finale (§18). */
export const QC_CRITERIA = [
  "hook",
  "story",
  "rhythm",
  "visual",
  "captions",
  "sound",
  "broll",
  "coherence",
  "styleMatch",
] as const;
export type QcCriterion = (typeof QC_CRITERIA)[number];

export const QcScoresSchema = z.object({
  hook: z.number().min(0).max(100),
  story: z.number().min(0).max(100),
  rhythm: z.number().min(0).max(100),
  visual: z.number().min(0).max(100),
  captions: z.number().min(0).max(100),
  sound: z.number().min(0).max(100),
  broll: z.number().min(0).max(100),
  coherence: z.number().min(0).max(100),
  styleMatch: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
});
export type QcScores = z.infer<typeof QcScoresSchema>;

export const CorrectionInstructionSchema = z.object({
  targetAgent: z.enum(["editor", "caption_director", "sound_designer", "broll_director", "story_director"]),
  instruction: z.string(),
  reason: z.string(),
});
export type CorrectionInstruction = z.infer<typeof CorrectionInstructionSchema>;

export interface QcReport {
  id: string;
  renderId: string;
  projectId: string;
  scores: QcScores;
  corrections: CorrectionInstruction[];
  passed: boolean;
  threshold: number;
  humanScore?: number;
  humanNotes?: string;
  createdAt: string;
}

/** Seuil MVP — une correction automatique au maximum (§5 Agent 09 du brief). */
export const QC_PASS_THRESHOLD = 82;
export const QC_MAX_AUTO_CORRECTIONS = 1;

import { z } from "zod";

export type ProjectStatus = "draft" | "processing" | "ready" | "failed";

export interface Project {
  id: string;
  userId: string;
  title: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export type MediaContainer = "mp4" | "mov" | "m4v" | "webm";
export type MediaCodec = "h264" | "h265" | "prores" | "vp9" | "av1" | "unknown";

/** Un fichier brut tel qu'uploadé — jamais modifié après ingestion. */
export interface Rush {
  id: string;
  projectId: string;
  originalFilename: string;
  storagePath: string;
  container: MediaContainer;
  codec: MediaCodec;
  durationSec: number;
  hasAudio: boolean;
  proxyPath?: string;
  proxyReady: boolean;
  createdAt: string;
}

export interface ReferenceVideo {
  id: string;
  projectId: string;
  storagePath: string;
  durationSec: number;
  createdAt: string;
}

/**
 * Sortie de l'Agent 02 (Video Analyzer) pour un segment de rush.
 * Toutes les scores sont dans [0, 1]. `start`/`end` sont en secondes,
 * relatifs au rush d'origine — jamais au proxy, jamais inventés : voir
 * validation.ts pour la vérification obligatoire contre la durée réelle.
 */
export const SegmentSchema = z.object({
  id: z.string(),
  rushId: z.string(),
  projectId: z.string(),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  transcript: z.string(),
  energy: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  hookPotential: z.number().min(0).max(1),
  visualQuality: z.number().min(0).max(1),
  narrativeInterest: z.number().min(0).max(1),
});

export type Segment = z.infer<typeof SegmentSchema>;

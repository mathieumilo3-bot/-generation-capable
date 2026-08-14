import { z } from "zod";

/**
 * Sortie de l'Agent 01 (Brief Analyzer). C'est la spec structurée que
 * tous les agents en aval consomment — jamais le texte libre de
 * l'utilisateur directement (surface d'injection, voir §11 du dossier
 * stratégique : le brief est une donnée, pas une instruction système).
 */
export const BriefSpecSchema = z.object({
  objective: z.string().min(1),
  audience: z.string().min(1),
  platform: z.enum(["tiktok", "instagram_reels", "youtube_shorts", "generic_vertical"]),
  /**
   * Durée cible en secondes — UNIQUEMENT si l'utilisateur l'a explicitement
   * demandée. `undefined` = aucune durée demandée : la durée est alors
   * DÉRIVÉE du contenu réel (voir duration-policy.ts), jamais forcée à une
   * valeur arbitraire. Plage large (1s à 1h) : un montage de 8s est aussi
   * légitime qu'un montage long. Il est INTERDIT de mettre 45 par défaut.
   */
  targetDurationSec: z.number().min(1).max(3600).optional(),
  tone: z.string().min(1),
  style: z.string().min(1),
  cta: z.string().optional(),
  dynamism: z.number().min(0).max(1),
  constraints: z.array(z.string()).default([]),
});

export type BriefSpec = z.infer<typeof BriefSpecSchema>;

export interface Brief {
  id: string;
  projectId: string;
  rawText: string;
  spec: BriefSpec | null;
  createdAt: string;
}

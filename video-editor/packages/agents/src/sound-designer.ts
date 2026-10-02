import type { Db } from "@video-editor/db";
import type { EditBlueprint, StyleProfile } from "@video-editor/shared-types";

/**
 * Agent 07 — Sound Designer. MVP : sélection dans la bibliothèque
 * licenciée (jamais de génération, cf. dossier stratégique §06 — risque
 * de droits musicaux) + volume dérivé du style profile. Le nettoyage
 * vocal et la normalisation de loudness sont gérés par le moteur de
 * rendu (packages/render/src/ffmpeg.ts::normalizeLoudness), pas ici :
 * ce sont des opérations déterministes sur les pixels/l'audio, pas des
 * décisions créatives.
 */
export function runSoundDesigner(
  db: Db,
  editBlueprint: EditBlueprint,
  styleProfile: StyleProfile
): { editBlueprint: EditBlueprint; musicFilePath: string | null } {
  const moodTag = styleProfile.musicIntensity >= 0.55 ? "energetic" : "calm";
  const matches = db.listStockMediaByTag(moodTag);
  if (matches.length === 0) {
    return { editBlueprint: { ...editBlueprint, music: null }, musicFilePath: null };
  }
  const chosen = matches[0]!;
  const volumeDb = -24 + styleProfile.musicIntensity * 12; // -24dB (discret) à -12dB (présent)
  const music = {
    // trackId = l'id réel de media_library (pas un id généré à la volée) —
    // indispensable pour pouvoir retrouver le fichier plus tard (édition
    // conversationnelle, apps/web/src/app/api/projects/[id]/edit).
    trackId: chosen.id,
    source: "stock_library" as const,
    title: chosen.storagePath.split("/").pop() ?? "piste stock",
    volumeDb,
    duckingEnabled: true,
  };
  return { editBlueprint: { ...editBlueprint, music }, musicFilePath: chosen.storagePath };
}

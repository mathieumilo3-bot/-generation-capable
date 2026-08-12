import { BUILT_IN_STYLE_PROFILES, newId, type StyleProfile } from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import { probe, detectSceneCuts } from "@video-editor/render";

/**
 * Résout le style profile d'un projet (§6 du brief). Chemin "preset" :
 * un des trois gabarits internes. Chemin "références" : mesure réelle
 * (sans IA) de `average_cut_duration` par détection de changement de
 * plan sur les vidéos de référence fournies — le reste des dimensions
 * (style de sous-titres, transitions...) reste dérivé du preset le plus
 * proche tant qu'aucune analyse vision n'est branchée (extraction
 * qualitative complète = raffinement futur, cf. dossier stratégique §01).
 */
export async function resolveStyleProfile(
  db: Db,
  projectId: string,
  input: { presetId?: string; referenceVideoPaths?: string[] }
): Promise<StyleProfile> {
  const basePreset =
    BUILT_IN_STYLE_PROFILES.find((p) => p.id === input.presetId) ??
    BUILT_IN_STYLE_PROFILES.find((p) => p.id === "preset_dynamic_social")!;

  if (!input.referenceVideoPaths || input.referenceVideoPaths.length === 0) {
    const profile: StyleProfile = { ...basePreset, id: newId("style"), source: "preset" };
    db.saveStyleProfile(profile, projectId);
    return profile;
  }

  const measurements: number[] = [];
  for (const path of input.referenceVideoPaths) {
    try {
      const info = await probe(path);
      const cuts = await detectSceneCuts(path);
      const cutCount = cuts.length + 1;
      measurements.push(info.durationSec / cutCount);
    } catch (err) {
      console.warn(`[style_extractor] analyse de référence échouée pour ${path}: ${(err as Error).message}`);
    }
  }

  if (measurements.length === 0) {
    const profile: StyleProfile = { ...basePreset, id: newId("style"), source: "preset" };
    db.saveStyleProfile(profile, projectId);
    return profile;
  }

  const avgCutDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;
  const closest = [...BUILT_IN_STYLE_PROFILES].sort(
    (a, b) => Math.abs(a.averageCutDuration - avgCutDuration) - Math.abs(b.averageCutDuration - avgCutDuration)
  )[0]!;

  const profile: StyleProfile = {
    ...closest,
    id: newId("style"),
    name: "Extrait des références",
    source: "reference_videos",
    averageCutDuration: Math.max(0.5, avgCutDuration),
    hookDuration: Math.max(1, Math.min(3, avgCutDuration * 1.3)),
  };
  db.saveStyleProfile(profile, projectId);
  return profile;
}

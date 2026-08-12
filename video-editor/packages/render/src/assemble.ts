import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { EditBlueprint } from "@video-editor/shared-types";
import { cutClip, concatClips, finalEncode, mixAudioWithMusic, burnCaptionsFallback, probe, normalizeLoudness } from "./ffmpeg.js";
import { renderHabillage, type HabillageCaptionStyle } from "./remotion.js";

export interface AssembleOptions {
  width: number;
  height: number;
  fps: number;
  workDir: string;
  captionStyle: HabillageCaptionStyle;
  rushPathById: Record<string, string>;
  musicFilePath?: string | null;
  musicVolumeDb?: number;
}

export interface AssembleResult {
  outputPath: string;
  durationSec: number;
  usedRemotionHabillage: boolean;
  warnings: string[];
}

/**
 * Exécute une timeline déjà décidée par les agents. Cette fonction ne
 * prend aucune décision créative — elle traduit le JSON de l'EditBlueprint
 * en appels FFmpeg/Remotion déterministes, dans l'ordre : cut → concat →
 * musique → habillage (Remotion, avec repli FFmpeg si l'environnement ne
 * peut pas rendre Remotion) → encodage final (§4, §7 du brief produit).
 */
export async function assembleFromBlueprint(
  blueprint: EditBlueprint,
  outputPath: string,
  opts: AssembleOptions
): Promise<AssembleResult> {
  const warnings: string[] = [];
  await mkdir(opts.workDir, { recursive: true });

  // 1. Cut — un fichier par clip, déjà recadré au format cible (pas de zoom baked-in : le zoom vit dans l'habillage Remotion).
  const clipPaths: string[] = [];
  for (const clip of blueprint.clips) {
    const rushPath = opts.rushPathById[clip.rushId];
    if (!rushPath) throw new Error(`Rush introuvable pour le clip ${clip.id}: ${clip.rushId}`);
    const clipOut = join(opts.workDir, `clip_${clip.id}.mp4`);
    await cutClip(rushPath, { start: clip.sourceStart, end: clip.sourceEnd }, clipOut, {
      targetWidth: opts.width,
      targetHeight: opts.height,
    });
    clipPaths.push(clipOut);
  }

  // 2. Concat
  const rawCutPath = join(opts.workDir, "base_cut_raw.mp4");
  await concatClips(clipPaths, rawCutPath);

  // 2b. Normalisation de loudness — gratuit en qualité perçue, aucune IA nécessaire.
  let cutPath = rawCutPath;
  const normalizedPath = join(opts.workDir, "base_cut.mp4");
  try {
    await normalizeLoudness(rawCutPath, normalizedPath);
    cutPath = normalizedPath;
  } catch (err) {
    warnings.push(`Normalisation de loudness échouée, audio non normalisé: ${(err as Error).message}`);
  }
  const cutInfo = await probe(cutPath);

  // 3. Musique (optionnelle)
  let withAudioPath = cutPath;
  if (opts.musicFilePath) {
    const mixedPath = join(opts.workDir, "with_music.mp4");
    try {
      await mixAudioWithMusic(cutPath, opts.musicFilePath, mixedPath, {
        musicVolumeDb: opts.musicVolumeDb ?? -18,
        duckingEnabled: true,
      });
      withAudioPath = mixedPath;
    } catch (err) {
      warnings.push(`Mixage musique échoué, export sans musique: ${(err as Error).message}`);
    }
  }

  // 4. Habillage (sous-titres animés + zoom) — Remotion, avec repli FFmpeg
  const fps = opts.fps;
  const durationInFrames = Math.max(1, Math.round(cutInfo.durationSec * fps));
  const captionsForRemotion = blueprint.captions.map((c) => ({
    startFrame: Math.round(c.timelineStart * fps),
    endFrame: Math.round(c.timelineEnd * fps),
    words: c.words.map((w) => ({
      word: w.word,
      startFrame: Math.round(w.start * fps),
      endFrame: Math.round(w.end * fps),
      emphasize: w.emphasize,
    })),
  }));
  const zoomWindows = blueprint.clips
    .filter((c) => c.zoomKeyframes.length > 0)
    .map((c) => ({
      startFrame: Math.round(c.timelineStart * fps),
      endFrame: Math.round((c.timelineStart + c.outDuration) * fps),
      scale: c.zoomKeyframes[0]!.scale,
    }));

  let habillagePath = withAudioPath;
  let usedRemotionHabillage = false;
  try {
    const remotionOut = join(opts.workDir, "habillage.mp4");
    await renderHabillage({
      videoSrc: withAudioPath,
      outputPath: remotionOut,
      durationInFrames,
      fps,
      width: opts.width,
      height: opts.height,
      captions: captionsForRemotion,
      zoomWindows,
      captionStyle: opts.captionStyle,
    });
    habillagePath = remotionOut;
    usedRemotionHabillage = true;
  } catch (err) {
    warnings.push(`Rendu Remotion indisponible dans cet environnement (${(err as Error).message}) — repli sous-titres FFmpeg, sans zoom animé.`);
    const fallbackOut = join(opts.workDir, "captions_fallback.mp4");
    await burnCaptionsFallback(
      withAudioPath,
      fallbackOut,
      blueprint.captions.map((c) => ({ text: c.text, startSec: c.timelineStart, endSec: c.timelineEnd }))
    );
    habillagePath = fallbackOut;
  }

  // 5. Export final
  await finalEncode(habillagePath, outputPath, { width: opts.width, height: opts.height, fps });
  const finalInfo = await probe(outputPath);

  // Le workDir n'est PAS supprimé ici : le supprimer pendant que le bundle
  // Remotion mis en cache (packages/render/src/remotion.ts) est encore actif
  // pour ce process casse le service statique de publicDir pour tous les
  // rendus suivants (constaté empiriquement — un rendu réussit, les
  // suivants échouent en 404 dès que le dossier d'un rendu précédent a été
  // effacé). Nettoyage différé = TODO explicite (job de purge périodique
  // sur storage/<project>/work/), pas un oubli.

  return { outputPath, durationSec: finalInfo.durationSec, usedRemotionHabillage, warnings };
}

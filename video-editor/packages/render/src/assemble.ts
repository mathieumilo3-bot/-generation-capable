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
 * en appels FFmpeg/Remotion déterministes, avec optimisations pour réduire
 * les réencodages inutiles :
 * - Cut → Concat (format fixe, pas de ré-encode)
 * - Music mix appliquée directement si nécessaire
 * - Habillage Remotion OU fallback FFmpeg en single pass
 * - Export final sans ré-encode supplémentaire si déjà au bon format
 * (§4, §7 du brief produit).
 */
export async function assembleFromBlueprint(
  blueprint: EditBlueprint,
  outputPath: string,
  opts: AssembleOptions
): Promise<AssembleResult> {
  const warnings: string[] = [];
  await mkdir(opts.workDir, { recursive: true });
  const { generateFastPreview, validateFinalRender } = await import("./ffmpeg.js");

  // ÉTAPE 1: Cut — un fichier par clip, recadré au format cible
  console.log(`[assemble] Cutting ${blueprint.clips.length} clips…`);
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

  // ÉTAPE 2: Concat — pas de re-encode, copie directe des streams
  console.log(`[assemble] Concatenating ${clipPaths.length} clips…`);
  const concatPath = join(opts.workDir, "base_concat.mp4");
  await concatClips(clipPaths, concatPath);
  const concatInfo = await probe(concatPath);

  // ÉTAPE 3: Audio mix (musique optionnelle) — appliquer ICI si musique présente
  console.log(`[assemble] ${opts.musicFilePath ? "Mixing audio with music…" : "No music to mix"}`);
  let audioPath = concatPath;
  if (opts.musicFilePath) {
    const audioMixPath = join(opts.workDir, "with_music.mp4");
    try {
      await mixAudioWithMusic(concatPath, opts.musicFilePath, audioMixPath, {
        musicVolumeDb: opts.musicVolumeDb ?? -18,
        duckingEnabled: true,
      });
      audioPath = audioMixPath;
    } catch (err) {
      warnings.push(`Music mixing failed, continuing without music: ${(err as Error).message}`);
    }
  }

  // ÉTAPE 4: Habillage (sous-titres animés + zoom) — Remotion OU repli FFmpeg
  console.log(`[assemble] Rendering habillage (${opts.captionStyle})…`);
  const fps = opts.fps;
  const durationInFrames = Math.max(1, Math.round(concatInfo.durationSec * fps));
  let habillagePath = audioPath;
  let usedRemotionHabillage = false;

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

  try {
    const remotionOut = join(opts.workDir, "habillage.mp4");
    console.log(`[assemble] Trying Remotion render…`);
    await renderHabillage({
      videoSrc: audioPath,
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
    console.log(`[assemble] Remotion render succeeded`);
  } catch (err) {
    console.log(`[assemble] Remotion unavailable, using FFmpeg fallback (drawtext captions)`);
    warnings.push(`Remotion unavailable (${(err as Error).message}), using FFmpeg caption burn instead`);
    const fallbackOut = join(opts.workDir, "captions_fallback.mp4");
    await import("./ffmpeg.js").then(({ burnCaptionsFallback }) =>
      burnCaptionsFallback(
        audioPath,
        fallbackOut,
        blueprint.captions.map((c) => ({ text: c.text, startSec: c.timelineStart, endSec: c.timelineEnd }))
      )
    );
    habillagePath = fallbackOut;
  }

  // ÉTAPE 5: Export final — format cible uniquement si nécessaire
  console.log(`[assemble] Final export to ${opts.width}x${opts.height}@${opts.fps}fps…`);
  await finalEncode(habillagePath, outputPath, { width: opts.width, height: opts.height, fps });

  // ÉTAPE 6: Valider le fichier final
  console.log(`[assemble] Validating final render…`);
  const validation = await validateFinalRender(outputPath);
  if (!validation.isValid) {
    throw new Error(`Final render validation failed: ${validation.issues.join("; ")}`);
  }

  const finalInfo = await probe(outputPath);
  console.log(`[assemble] Complete: ${(finalInfo.durationSec).toFixed(1)}s @ ${finalInfo.width}x${finalInfo.height}`);

  return { outputPath, durationSec: finalInfo.durationSec, usedRemotionHabillage, warnings };
}

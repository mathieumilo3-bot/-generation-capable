import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { EditBlueprint } from "@video-editor/shared-types";
import { cutClip, concatClips, finalizeOutput, mixAudioWithMusic, overlayBroll, probe, type BrollOverlay } from "./ffmpeg.js";
import { renderHabillage, type HabillageCaptionStyle } from "./remotion.js";
import { renderHabillageFFmpeg, type FfmpegHabillageSpec } from "./ffmpeg-habillage.js";

export interface AssembleProfile {
  cutPreset?: string;
  cutCrf?: number;
  finalPreset?: string;
  finalCrf?: number;
  remotionConcurrency?: number | null;
}

export interface AssembleOptions {
  width: number;
  height: number;
  fps: number;
  workDir: string;
  captionStyle: HabillageCaptionStyle;
  rushPathById: Record<string, string>;
  musicFilePath?: string | null;
  musicVolumeDb?: number;
  /** Profil de rendu (§10) — presets/CRF FFmpeg + concurrence Remotion. Défauts = comportement historique. */
  profile?: AssembleProfile;
  /**
   * Progression RÉELLE du rendu Remotion (frames rendues), pour afficher
   * "Export final — X%" + heartbeat. Jamais simulé.
   */
  onRenderProgress?: (p: { renderedFrames: number; totalFrames: number; concurrency: number }) => void;
}

export interface AssembleResult {
  outputPath: string;
  durationSec: number;
  usedRemotionHabillage: boolean;
  warnings: string[];
  /** Décomposition des temps (§20 monitoring) — mesurés, jamais estimés. */
  timings: {
    cutMs: number;
    concatMs: number;
    habillageMs: number;
    encodeMs: number;
  };
  framesRendered?: number;
  /** Concurrence Remotion réellement utilisée pour ce rendu. */
  renderConcurrency?: number;
  /** true si l'export final a évité un ré-encodage (stream copy, §5). */
  finalStreamCopied: boolean;
}

/**
 * Exécute une timeline déjà décidée par les agents. Cette fonction ne
 * prend aucune décision créative — elle traduit le JSON de l'EditBlueprint
 * en appels FFmpeg/Remotion déterministes, avec des optimisations pour
 * réduire les réencodages inutiles :
 * - Cut → Concat (format fixe, pas de ré-encode au concat)
 * - Music mix appliquée directement si nécessaire
 * - Habillage Remotion OU fallback FFmpeg en single pass
 * - Export final SANS ré-encodage si déjà au bon format (remux + faststart)
 * (§4, §5, §7, §10 du brief produit/factory).
 */
export async function assembleFromBlueprint(
  blueprint: EditBlueprint,
  outputPath: string,
  opts: AssembleOptions
): Promise<AssembleResult> {
  const warnings: string[] = [];
  await mkdir(opts.workDir, { recursive: true });
  const { validateFinalRender } = await import("./ffmpeg.js");
  const profile = opts.profile ?? {};

  // ÉTAPE 1: Cut — un fichier par clip, recadré au format cible
  console.log(`[assemble] Cutting ${blueprint.clips.length} clips…`);
  const tCut = Date.now();
  const clipPaths: string[] = [];
  for (const clip of blueprint.clips) {
    const rushPath = opts.rushPathById[clip.rushId];
    if (!rushPath) throw new Error(`Rush introuvable pour le clip ${clip.id}: ${clip.rushId}`);
    const clipOut = join(opts.workDir, `clip_${clip.id}.mp4`);
    await cutClip(rushPath, { start: clip.sourceStart, end: clip.sourceEnd }, clipOut, {
      targetWidth: opts.width,
      targetHeight: opts.height,
      preset: profile.cutPreset,
      crf: profile.cutCrf,
    });
    clipPaths.push(clipOut);
  }
  const cutMs = Date.now() - tCut;

  // ÉTAPE 2: Concat — pas de re-encode, copie directe des streams
  console.log(`[assemble] Concatenating ${clipPaths.length} clips…`);
  const tConcat = Date.now();
  const concatPath = join(opts.workDir, "base_concat.mp4");
  await concatClips(clipPaths, concatPath);
  let concatInfo = await probe(concatPath);
  const concatMs = Date.now() - tConcat;

  // ÉTAPE 2b: B-roll réel — uniquement les plans AVEC droits renseignés
  // (owner + license + proof) et un fichier présent ; jamais de plan sans droits.
  const brollOverlays: BrollOverlay[] = [];
  const clipStart = new Map<string, number>();
  {
    let t = 0;
    for (let i = 0; i < blueprint.clips.length; i++) {
      clipStart.set(blueprint.clips[i]!.id, t);
      t += (await probe(clipPaths[i]!)).durationSec;
    }
  }
  for (const slot of blueprint.brollSlots) {
    const l = slot.license;
    if (!slot.resolvedPath || !l || !l.owner || !l.license || !l.proof) continue;
    const at = clipStart.get(slot.afterClipId);
    if (at === undefined) continue;
    const start = Math.min(Math.max(0, at), Math.max(0, concatInfo.durationSec - slot.durationSec - 0.05));
    brollOverlays.push({ filePath: slot.resolvedPath, start, duration: slot.durationSec });
  }
  if (brollOverlays.length > 0) {
    try {
      const withBroll = join(opts.workDir, "base_broll.mp4");
      await overlayBroll(concatPath, brollOverlays, withBroll, { width: opts.width, height: opts.height });
      await rename(withBroll, concatPath);
      concatInfo = await probe(concatPath);
      console.log(`[assemble] B-roll : ${brollOverlays.length} plan(s) insérés`);
    } catch (err) {
      warnings.push(`B-roll non inséré, montage conservé sans: ${(err as Error).message}`);
    }
  }

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

  // ÉTAPE 4: Habillage (sous-titres animés + zoom) — FFmpeg hybride PAR DÉFAUT, Remotion en repli
  console.log(`[assemble] Rendering habillage (${opts.captionStyle})…`);
  const fps = opts.fps;
  const durationInFrames = Math.max(1, Math.round(concatInfo.durationSec * fps));
  let habillagePath = audioPath;
  let usedRemotionHabillage = false;
  let framesRendered: number | undefined;
  let renderConcurrency: number | undefined;

  const captionsForHabillage = blueprint.captions.map((c) => ({
    startSec: c.timelineStart,
    endSec: c.timelineEnd,
    text: c.text,
  }));

  const tHabillage = Date.now();

  // Essayer FFmpeg hybride EN PREMIER (chemin par défaut + plus rapide)
  const useFFmpegHybrid = process.env.VIDEO_EDITOR_HYBRID_HABILLAGE !== "0";
  if (useFFmpegHybrid) {
    try {
      const hybridOut = join(opts.workDir, "habillage_hybrid.mp4");
      console.log(`[assemble] Trying FFmpeg hybrid habillage…`);

      // Collecter tous les effets depuis les clips
      const allEffects: any[] = [];
      for (const c of blueprint.clips) {
        // Ajouter les effets existants avec temps absolus
        for (const e of c.effects ?? []) {
          const effectWithAbsoluteTime = { ...e } as any;
          if ("startSec" in effectWithAbsoluteTime) {
            effectWithAbsoluteTime.startSec = c.timelineStart + effectWithAbsoluteTime.startSec;
          }
          if ("endSec" in effectWithAbsoluteTime) {
            effectWithAbsoluteTime.endSec = c.timelineStart + effectWithAbsoluteTime.endSec;
          }
          allEffects.push(effectWithAbsoluteTime);
        }

        // Ajouter les effets zoom en tant qu'EffectSpec
        if (c.zoomKeyframes && c.zoomKeyframes.length > 0) {
          allEffects.push({
            type: "zoom",
            startSec: c.timelineStart,
            endSec: c.timelineStart + c.outDuration,
            keyframes: c.zoomKeyframes.map((z) => ({
              atSec: c.timelineStart + z.atSec,
              scale: z.scale,
              focusX: z.focusX ?? 0.5,
              focusY: z.focusY ?? 0.5,
            })),
          });
        }
      }

      const ffmpegSpec: FfmpegHabillageSpec = {
        inputPath: audioPath,
        outputPath: hybridOut,
        width: opts.width,
        height: opts.height,
        fps,
        durationSec: concatInfo.durationSec,
        effects: allEffects,
        captions: captionsForHabillage,
        preset: profile.finalPreset,
        crf: profile.finalCrf,
      };

      const r = await renderHabillageFFmpeg(ffmpegSpec);
      habillagePath = hybridOut;
      usedRemotionHabillage = false;
      framesRendered = r.framesRendered;
      console.log(`[assemble] FFmpeg hybrid render succeeded (${r.framesRendered} frames)`);
    } catch (err) {
      console.log(`[assemble] FFmpeg hybrid failed, falling back to Remotion: ${(err as Error).message}`);
    }
  }

  // Fallback vers Remotion si FFmpeg a échoué ou si désactivé explicitement
  if (habillagePath === audioPath && !process.env.VIDEO_EDITOR_HYBRID_HABILLAGE) {
    try {
      const remotionOut = join(opts.workDir, "habillage.mp4");
      console.log(`[assemble] Trying Remotion render…`);

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

      const r = await renderHabillage({
        videoSrc: audioPath,
        outputPath: remotionOut,
        durationInFrames,
        fps,
        width: opts.width,
        height: opts.height,
        captions: captionsForRemotion,
        zoomWindows,
        captionStyle: opts.captionStyle,
        concurrency: profile.remotionConcurrency ?? null,
        onProgress: opts.onRenderProgress,
      });
      habillagePath = remotionOut;
      usedRemotionHabillage = true;
      framesRendered = r.framesRendered;
      renderConcurrency = r.concurrency;
      console.log(`[assemble] Remotion render succeeded (concurrency=${r.concurrency})`);
    } catch (err) {
      console.log(`[assemble] Remotion also failed, using FFmpeg text burn…`);
      warnings.push(`Both FFmpeg hybrid and Remotion failed, using FFmpeg caption burn instead`);
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
  }

  const habillageMs = Date.now() - tHabillage;

  // ÉTAPE 5: Export final — remux stream-copy si déjà au format cible
  // (évite une passe libx264 complète redondante, §5), sinon vrai encodage.
  console.log(`[assemble] Finalizing to ${opts.width}x${opts.height}@${opts.fps}fps…`);
  const tEncode = Date.now();
  const { streamCopied } = await finalizeOutput(habillagePath, outputPath, {
    width: opts.width,
    height: opts.height,
    fps,
    preset: profile.finalPreset,
    crf: profile.finalCrf,
  });
  const encodeMs = Date.now() - tEncode;
  console.log(`[assemble] Final ${streamCopied ? "remux (stream copy, no re-encode)" : "encode"} done`);

  // ÉTAPE 6: Valider le fichier final (garde-fous anti-défauts §14/§15 :
  // pas de vide en fin, orientation conforme au format cible).
  console.log(`[assemble] Validating final render…`);
  const validation = await validateFinalRender(outputPath, {
    expectedWidth: opts.width,
    expectedHeight: opts.height,
  });
  if (!validation.isValid) {
    throw new Error(`Final render validation failed: ${validation.issues.join("; ")}`);
  }

  const finalInfo = await probe(outputPath);
  console.log(`[assemble] Complete: ${finalInfo.durationSec.toFixed(1)}s @ ${finalInfo.width}x${finalInfo.height}`);

  return {
    outputPath,
    durationSec: finalInfo.durationSec,
    usedRemotionHabillage,
    warnings,
    timings: { cutMs, concatMs, habillageMs, encodeMs },
    framesRendered,
    renderConcurrency,
    finalStreamCopied: streamCopied,
  };
}

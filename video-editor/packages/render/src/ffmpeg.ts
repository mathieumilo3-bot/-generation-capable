import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export class FfmpegError extends Error {
  constructor(
    message: string,
    public readonly stderr: string
  ) {
    super(message);
    this.name = "FfmpegError";
  }
}

async function runFfmpeg(args: string[], opts?: { timeoutMs?: number; operation?: string }): Promise<{ stdout: string; stderr: string }> {
  const operation = opts?.operation ?? "ffmpeg";
  const timeoutMs = opts?.timeoutMs ?? 600000; // 10 min default
  const opLabel = `[${operation}] `;
  const t0 = Date.now();

  try {
    let completed = false;
    const promise = execFileAsync("ffmpeg", ["-hide_banner", "-y", ...args], { maxBuffer: 1024 * 1024 * 64 });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        if (!completed) {
          const elapsed = Date.now() - t0;
          reject(new Error(`${operation} timeout après ${(elapsed / 1000).toFixed(1)}s (limite: ${(timeoutMs / 1000).toFixed(0)}s)`));
        }
      }, timeoutMs);
    });

    const result = await Promise.race([promise, timeoutPromise]);
    completed = true;
    const elapsed = Date.now() - t0;
    console.log(`${opLabel}Succès (${(elapsed / 1000).toFixed(1)}s)`);
    return result;
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.log(`${opLabel}Erreur après ${(elapsed / 1000).toFixed(1)}s`);
    const e = err as { stderr?: string; message: string };
    throw new FfmpegError(`${operation} a échoué: ${e.message}`, e.stderr ?? "");
  }
}

export interface MediaInfo {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
  videoCodec: string;
  container: string;
  /** Durée du flux vidéo (secondes) — peut différer du flux audio (dead air). */
  videoDurationSec: number;
  /** Durée du flux audio (secondes), 0 si pas d'audio. */
  audioDurationSec: number;
}

/** ffprobe — jamais faire confiance à une durée déclarée par le client, toujours re-mesurer (§11 du brief). */
export async function probe(filePath: string): Promise<MediaInfo> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  const json = JSON.parse(stdout) as {
    format: { duration: string; format_name: string };
    streams: { codec_type: string; codec_name: string; width?: number; height?: number; duration?: string }[];
  };
  const videoStream = json.streams.find((s) => s.codec_type === "video");
  const audioStream = json.streams.find((s) => s.codec_type === "audio");
  const formatDur = parseFloat(json.format.duration);
  const videoDurationSec = videoStream?.duration ? parseFloat(videoStream.duration) : formatDur;
  const audioDurationSec = audioStream?.duration ? parseFloat(audioStream.duration) : audioStream ? formatDur : 0;
  return {
    durationSec: formatDur,
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    hasAudio: Boolean(audioStream),
    videoCodec: videoStream?.codec_name ?? "unknown",
    container: json.format.format_name.split(",")[0] ?? "unknown",
    videoDurationSec: Number.isFinite(videoDurationSec) ? videoDurationSec : formatDur,
    audioDurationSec: Number.isFinite(audioDurationSec) ? audioDurationSec : 0,
  };
}

/**
 * Proxy basse résolution pour l'analyse et le rendu d'itération QA — on
 * n'envoie jamais le rush plein format à un modèle ni au rendu proxy
 * (§11 du brief : "ne pas envoyer inutilement les rushs complets").
 */
export async function generateProxy(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(
    [
      "-i",
      inputPath,
      "-vf",
      "scale=640:-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "30",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
      outputPath,
    ],
    { operation: "proxy_generation", timeoutMs: 120000 }
  );
}

export interface SilenceWindow {
  start: number;
  end: number;
}

/**
 * Détection de silence purement déterministe (filtre ffmpeg
 * `silencedetect`) — sert de repli au Video Analyzer quand aucune clé
 * STT/vision n'est configurée : on peut toujours proposer des
 * délimitations de segments à partir de l'énergie audio, sans IA (§22 du
 * brief : préférer une règle déterministe fiable à une IA absente).
 */
export async function detectSilence(
  inputPath: string,
  opts: { noiseDb?: number; minSilenceDurationSec?: number } = {}
): Promise<SilenceWindow[]> {
  const noiseDb = opts.noiseDb ?? -30;
  const minDur = opts.minSilenceDurationSec ?? 0.5;
  let stderr = "";
  try {
    const res = await runFfmpeg(
      [
        "-i",
        inputPath,
        "-af",
        `silencedetect=noise=${noiseDb}dB:d=${minDur}`,
        "-f",
        "null",
        "-",
      ],
      { operation: "silence_detection", timeoutMs: 120000 }
    );
    stderr = res.stderr;
  } catch (err) {
    if (err instanceof FfmpegError) stderr = err.stderr;
    else throw err;
  }
  const windows: SilenceWindow[] = [];
  const startRe = /silence_start:\s*(-?[\d.]+)/g;
  const endRe = /silence_end:\s*(-?[\d.]+)/g;
  const starts = [...stderr.matchAll(startRe)].map((m) => parseFloat(m[1]!));
  const ends = [...stderr.matchAll(endRe)].map((m) => parseFloat(m[1]!));
  for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
    windows.push({ start: starts[i]!, end: ends[i]! });
  }
  return windows;
}

/** Segments non silencieux = candidats de plans exploitables, dérivés des silences détectés. */
export function nonSilentSegments(totalDurationSec: number, silences: SilenceWindow[]): SilenceWindow[] {
  const sorted = [...silences].sort((a, b) => a.start - b.start);
  const segments: SilenceWindow[] = [];
  let cursor = 0;
  for (const s of sorted) {
    if (s.start > cursor) segments.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < totalDurationSec) segments.push({ start: cursor, end: totalDurationSec });
  return segments.filter((s) => s.end - s.start > 0.3);
}

export interface BrightnessStats {
  /** Luma moyenne 0-255 (YAVG). < ~40 = très sombre, > ~235 = cramé. */
  yavg: number;
  /** true si le plan est trop sombre pour être exploitable tel quel. */
  tooDark: boolean;
  /** true si le plan est surexposé/cramé. */
  tooBright: boolean;
}

/**
 * Mesure la luminosité réelle d'un plan via le filtre `signalstats`
 * (YAVG = luma moyenne sur 255). Sert à REJETER les plans inexploitables
 * (nuit sous-exposée, contre-jour cramé) avant qu'ils ne polluent le
 * montage — c'est une vraie mesure ffmpeg, pas une heuristique de
 * résolution. On échantillonne quelques images (fps bas) pour rester
 * rapide sur un long rush.
 */
export async function measureBrightness(inputPath: string, window?: SilenceWindow): Promise<BrightnessStats> {
  const args: string[] = [];
  if (window) args.push("-ss", String(window.start), "-to", String(window.end));
  // 2 images/s suffisent pour une moyenne stable ; on plafonne le coût.
  args.push("-i", inputPath, "-vf", "fps=2,signalstats,metadata=print", "-an", "-f", "null", "-");
  let stderr = "";
  try {
    const res = await runFfmpeg(args, { operation: "brightness", timeoutMs: 60000 });
    stderr = res.stderr;
  } catch (err) {
    if (err instanceof FfmpegError) stderr = err.stderr;
    else throw err;
  }
  const values = [...stderr.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) => parseFloat(m[1]!));
  const yavg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 128;
  return { yavg, tooDark: yavg < 40, tooBright: yavg > 235 };
}

export interface VolumeStats {
  meanVolumeDb: number;
  maxVolumeDb: number;
}

/** Statistiques de niveau audio (filtre `volumedetect`) — utilisées pour un score d'énergie déterministe. */
export async function volumeStats(inputPath: string, window?: SilenceWindow): Promise<VolumeStats> {
  const args: string[] = [];
  if (window) args.push("-ss", String(window.start), "-to", String(window.end));
  args.push("-i", inputPath, "-af", "volumedetect", "-f", "null", "-");
  let stderr = "";
  try {
    const res = await runFfmpeg(args, { operation: "volume_stats", timeoutMs: 60000 });
    stderr = res.stderr;
  } catch (err) {
    if (err instanceof FfmpegError) stderr = err.stderr;
    else throw err;
  }
  const mean = /mean_volume:\s*(-?[\d.]+)\s*dB/.exec(stderr);
  const max = /max_volume:\s*(-?[\d.]+)\s*dB/.exec(stderr);
  return {
    meanVolumeDb: mean ? parseFloat(mean[1]!) : -60,
    maxVolumeDb: max ? parseFloat(max[1]!) : -60,
  };
}

export interface CutClipOptions {
  targetWidth: number;
  targetHeight: number;
  /** Punch-in statique (§4 Editor Agent) — un vrai zoom animé image par image vit dans la composition Remotion, pas ici. */
  zoomScale?: number;
  /** Preset libx264 (profil de rendu §10). Défaut veryfast = comportement historique. */
  preset?: string;
  /** CRF (profil de rendu §10). Défaut 20 = comportement historique. */
  crf?: number;
}

/**
 * Découpe un clip source et le recadre au format cible (crop-then-scale,
 * centré). C'est la seule opération qui touche aux pixels du rush — tout
 * le reste (quel segment, quel zoom, dans quel ordre) a été décidé en
 * amont par les agents, jamais ici.
 */
export async function cutClip(
  inputPath: string,
  window: SilenceWindow,
  outputPath: string,
  opts: CutClipOptions
): Promise<void> {
  const scale = opts.zoomScale && opts.zoomScale > 1 ? opts.zoomScale : 1;
  const targetRatio = opts.targetWidth / opts.targetHeight;
  const vf = [
    `crop='if(gt(a,${targetRatio}),ih*${targetRatio},iw)':'if(gt(a,${targetRatio}),ih,iw/${targetRatio})'`,
    `scale=${Math.round(opts.targetWidth * scale)}:${Math.round(opts.targetHeight * scale)}`,
    scale > 1
      ? `crop=${opts.targetWidth}:${opts.targetHeight}`
      : `scale=${opts.targetWidth}:${opts.targetHeight}`,
  ].join(",");
  const durationSec = window.end - window.start;
  await runFfmpeg(
    [
      "-ss",
      String(window.start),
      "-to",
      String(window.end),
      "-i",
      inputPath,
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-preset",
      opts.preset ?? "veryfast",
      "-crf",
      String(opts.crf ?? 20),
      "-c:a",
      "aac",
      "-ar",
      "48000",
      outputPath,
    ],
    { operation: `cut_clip_${durationSec.toFixed(1)}s`, timeoutMs: Math.max(60000, durationSec * 15000) }
  );
}

/** Concaténation des clips déjà découpés/recadrés au même format — ré-encode pour garantir des paramètres identiques (durabilité > micro-optimisation). */
export async function concatClips(clipPaths: string[], outputPath: string): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "ve-concat-"));
  const listPath = join(dir, "list.txt");
  const listContent = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, listContent, "utf-8");
  try {
    await runFfmpeg(
      ["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath],
      { operation: `concat_${clipPaths.length}_clips`, timeoutMs: 120000 }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Mixage musique + voix avec ducking simplifié : la musique baisse
 * automatiquement quand la voix est présente (sidechaincompress). Repli
 * documenté du dossier stratégique §07 — un vrai mix de sound design
 * multi-piste (SFX, ambiances) viendra une fois le cœur validé.
 */
export async function mixAudioWithMusic(
  videoWithVoicePath: string,
  musicPath: string,
  outputPath: string,
  opts: { musicVolumeDb: number; duckingEnabled: boolean }
): Promise<void> {
  const musicGain = Math.pow(10, opts.musicVolumeDb / 20);
  const filter = opts.duckingEnabled
    ? `[1:a]volume=${musicGain}[music];[music][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=300[duckedmusic];[0:a][duckedmusic]amix=inputs=2:duration=first:dropout_transition=0[aout]`
    : `[1:a]volume=${musicGain}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=0[aout]`;
  await runFfmpeg(
    [
      "-i",
      videoWithVoicePath,
      "-i",
      musicPath,
      "-filter_complex",
      filter,
      "-map",
      "0:v",
      "-map",
      "[aout]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      outputPath,
    ],
    { operation: "mix_audio_music", timeoutMs: 120000 }
  );
}

/** Repli de sous-titres si le rendu Remotion (habillage) n'est pas disponible dans l'environnement — jamais livrer une vidéo sans sous-titres si le style demandé en attend. */
export async function burnCaptionsFallback(
  inputPath: string,
  outputPath: string,
  captions: { text: string; startSec: number; endSec: number }[]
): Promise<void> {
  if (captions.length === 0) {
    await runFfmpeg(["-i", inputPath, "-c", "copy", outputPath], { operation: "passthrough_copy", timeoutMs: 60000 });
    return;
  }
  const drawtextFilters = captions
    .map((c) => {
      const escaped = c.text.replace(/:/g, "\\:").replace(/'/g, "\\'");
      return `drawtext=text='${escaped}':fontcolor=white:fontsize=54:box=1:boxcolor=black@0.55:boxborderw=16:x=(w-text_w)/2:y=h*0.78:enable='between(t,${c.startSec},${c.endSec})'`;
    })
    .join(",");
  await runFfmpeg(
    ["-i", inputPath, "-vf", drawtextFilters, "-c:a", "copy", outputPath],
    { operation: `burn_${captions.length}_captions`, timeoutMs: 180000 }
  );
}

export interface FinalEncodeOptions {
  width: number;
  height: number;
  fps: number;
  /** Preset libx264 (profil de rendu §10). Défaut medium = comportement historique. */
  preset?: string;
  /** CRF (profil de rendu §10). Défaut 18 = comportement historique. */
  crf?: number;
}

/** Export final prêt-plateforme : faststart pour lecture immédiate côté client. */
export async function finalEncode(inputPath: string, outputPath: string, opts: FinalEncodeOptions): Promise<void> {
  await runFfmpeg(
    [
      "-i",
      inputPath,
      "-vf",
      `scale=${opts.width}:${opts.height},fps=${opts.fps}`,
      "-c:v",
      "libx264",
      "-preset",
      opts.preset ?? "medium",
      "-crf",
      String(opts.crf ?? 18),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { operation: `final_encode_${opts.width}x${opts.height}`, timeoutMs: 600000 }
  );
}

/**
 * Finalisation SANS ré-encodage vidéo (§5, §10 du brief factory) : quand
 * la vidéo d'habillage est DÉJÀ au format cible (largeur/hauteur/fps
 * corrects, codec h264 — ce qui est le cas car cutClip a déjà recadré au
 * format et Remotion rend directement à la bonne taille), une passe
 * libx264 complète est du gaspillage pur. On se contente d'un remux
 * stream-copy + faststart : quasi instantané, qualité identique bit pour
 * bit. Repli sur un vrai encodage si le format ne correspond pas.
 *
 * Renvoie true si le chemin rapide (copy) a été pris.
 */
export async function finalizeOutput(
  inputPath: string,
  outputPath: string,
  opts: FinalEncodeOptions
): Promise<{ streamCopied: boolean }> {
  let info: MediaInfo | null = null;
  try {
    info = await probe(inputPath);
  } catch {
    info = null;
  }
  const matchesTarget =
    info !== null && info.width === opts.width && info.height === opts.height && info.videoCodec === "h264";

  if (matchesTarget) {
    // Remux uniquement : conteneur + faststart, aucun pixel retouché.
    await runFfmpeg(
      ["-i", inputPath, "-c", "copy", "-movflags", "+faststart", outputPath],
      { operation: `finalize_remux_${opts.width}x${opts.height}`, timeoutMs: 120000 }
    );
    return { streamCopied: true };
  }

  await finalEncode(inputPath, outputPath, opts);
  return { streamCopied: false };
}

export async function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(
    ["-i", inputPath, "-vn", "-c:a", "libmp3lame", "-q:a", "4", outputPath],
    { operation: "extract_audio", timeoutMs: 120000 }
  );
}

/**
 * Détection de coupes par changement de plan (filtre `select='gt(scene,…)'`)
 * — sert à mesurer `average_cut_duration` sur une vidéo de référence sans
 * aucun modèle IA (Agent 10 / style profile, packages/agents/src/style-extractor.ts).
 */
export async function detectSceneCuts(inputPath: string, threshold = 0.35): Promise<number[]> {
  let stderr = "";
  try {
    const res = await runFfmpeg(
      ["-i", inputPath, "-vf", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"],
      { operation: "detect_scene_cuts", timeoutMs: 120000 }
    );
    stderr = res.stderr;
  } catch (err) {
    if (err instanceof FfmpegError) stderr = err.stderr;
    else throw err;
  }
  const re = /pts_time:([\d.]+)/g;
  return [...stderr.matchAll(re)].map((m) => parseFloat(m[1]!));
}

/** Normalisation de loudness (EBU R128) — améliore directement le critère QC "sound" sans aucune IA. */
export async function normalizeLoudness(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(
    [
      "-i",
      inputPath,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      outputPath,
    ],
    { operation: "normalize_loudness", timeoutMs: 120000 }
  );
}

export interface ValidateRenderOptions {
  /** Format attendu — rejette une orientation inattendue (ex: paysage alors qu'on vise du vertical). */
  expectedWidth?: number;
  expectedHeight?: number;
}

/**
 * Garde-fou final (§14, §15 du brief factory) : une vidéo qui présente
 * l'un des défauts ci-dessous ne doit JAMAIS être livrée. Ces contrôles
 * rendent structurellement impossibles les défauts constatés sur les
 * mauvais rendus (8 s de silence en fin, mauvaise orientation) — le rendu
 * échoue explicitement au lieu de livrer une vidéo "horrible".
 */
export async function validateFinalRender(
  filePath: string,
  opts?: ValidateRenderOptions
): Promise<{ isValid: boolean; issues: string[] }> {
  const issues: string[] = [];
  try {
    const info = await probe(filePath);
    if (info.durationSec < 1) issues.push("Durée inférieure à 1 seconde");
    if (info.width < 640 || info.height < 360) issues.push(`Résolution ${info.width}x${info.height} trop basse`);
    if (!info.videoCodec || info.videoCodec === "unknown") issues.push("Aucun codec vidéo détecté");

    // ANTI-DEAD-AIR : la vidéo ne doit pas se prolonger dans le silence
    // bien après la fin de l'audio (le défaut "8 s de vide" constaté).
    if (info.hasAudio && info.audioDurationSec > 0) {
      const gap = info.videoDurationSec - info.audioDurationSec;
      const tolerance = Math.max(2, info.videoDurationSec * 0.15);
      if (gap > tolerance) {
        issues.push(
          `Vide en fin de vidéo : la vidéo dure ${info.videoDurationSec.toFixed(1)}s mais l'audio s'arrête à ${info.audioDurationSec.toFixed(1)}s (${gap.toFixed(1)}s de silence)`
        );
      }
    } else if (!info.hasAudio) {
      issues.push("Aucune piste audio dans le rendu final");
    }

    // ORIENTATION attendue (ex: vertical pour les réseaux sociaux).
    if (opts?.expectedWidth && opts?.expectedHeight) {
      const expectedPortrait = opts.expectedHeight > opts.expectedWidth;
      const actualPortrait = info.height > info.width;
      if (expectedPortrait !== actualPortrait) {
        issues.push(
          `Orientation inattendue : ${info.width}x${info.height} (attendu ${opts.expectedWidth}x${opts.expectedHeight})`
        );
      }
    }

    return { isValid: issues.length === 0, issues };
  } catch (err) {
    return { isValid: false, issues: [(err as Error).message] };
  }
}

export async function generateFastPreview(
  inputPath: string,
  outputPath: string,
  width: number = 640,
  height: number = 360
): Promise<void> {
  await runFfmpeg(
    [
      "-i",
      inputPath,
      "-vf",
      `scale=${width}:${height},fps=24`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "48k",
      outputPath,
    ],
    { operation: `fast_preview_${width}x${height}`, timeoutMs: 60000 }
  );
}

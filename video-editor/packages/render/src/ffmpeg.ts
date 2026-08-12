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

async function runFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync("ffmpeg", ["-hide_banner", "-y", ...args], { maxBuffer: 1024 * 1024 * 64 });
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    throw new FfmpegError(`ffmpeg a échoué: ${e.message}`, e.stderr ?? "");
  }
}

export interface MediaInfo {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
  videoCodec: string;
  container: string;
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
    streams: { codec_type: string; codec_name: string; width?: number; height?: number }[];
  };
  const videoStream = json.streams.find((s) => s.codec_type === "video");
  const audioStream = json.streams.find((s) => s.codec_type === "audio");
  return {
    durationSec: parseFloat(json.format.duration),
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    hasAudio: Boolean(audioStream),
    videoCodec: videoStream?.codec_name ?? "unknown",
    container: json.format.format_name.split(",")[0] ?? "unknown",
  };
}

/**
 * Proxy basse résolution pour l'analyse et le rendu d'itération QA — on
 * n'envoie jamais le rush plein format à un modèle ni au rendu proxy
 * (§11 du brief : "ne pas envoyer inutilement les rushs complets").
 */
export async function generateProxy(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg([
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
  ]);
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
    const res = await runFfmpeg([
      "-i",
      inputPath,
      "-af",
      `silencedetect=noise=${noiseDb}dB:d=${minDur}`,
      "-f",
      "null",
      "-",
    ]);
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
    const res = await runFfmpeg(args);
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
    // crop à l'aspect ratio cible en gardant le centre, puis scale + zoom éventuel
    `crop='if(gt(a,${targetRatio}),ih*${targetRatio},iw)':'if(gt(a,${targetRatio}),ih,iw/${targetRatio})'`,
    `scale=${Math.round(opts.targetWidth * scale)}:${Math.round(opts.targetHeight * scale)}`,
    scale > 1
      ? `crop=${opts.targetWidth}:${opts.targetHeight}`
      : `scale=${opts.targetWidth}:${opts.targetHeight}`,
  ].join(",");
  await runFfmpeg([
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
    "veryfast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    outputPath,
  ]);
}

/** Concaténation des clips déjà découpés/recadrés au même format — ré-encode pour garantir des paramètres identiques (durabilité > micro-optimisation). */
export async function concatClips(clipPaths: string[], outputPath: string): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "ve-concat-"));
  const listPath = join(dir, "list.txt");
  const listContent = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, listContent, "utf-8");
  try {
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath]);
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
  await runFfmpeg([
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
  ]);
}

/** Repli de sous-titres si le rendu Remotion (habillage) n'est pas disponible dans l'environnement — jamais livrer une vidéo sans sous-titres si le style demandé en attend. */
export async function burnCaptionsFallback(
  inputPath: string,
  outputPath: string,
  captions: { text: string; startSec: number; endSec: number }[]
): Promise<void> {
  if (captions.length === 0) {
    await runFfmpeg(["-i", inputPath, "-c", "copy", outputPath]);
    return;
  }
  const drawtextFilters = captions
    .map((c) => {
      const escaped = c.text.replace(/:/g, "\\:").replace(/'/g, "\\'");
      return `drawtext=text='${escaped}':fontcolor=white:fontsize=54:box=1:boxcolor=black@0.55:boxborderw=16:x=(w-text_w)/2:y=h*0.78:enable='between(t,${c.startSec},${c.endSec})'`;
    })
    .join(",");
  await runFfmpeg(["-i", inputPath, "-vf", drawtextFilters, "-c:a", "copy", outputPath]);
}

export interface FinalEncodeOptions {
  width: number;
  height: number;
  fps: number;
}

/** Export final prêt-plateforme : faststart pour lecture immédiate côté client. */
export async function finalEncode(inputPath: string, outputPath: string, opts: FinalEncodeOptions): Promise<void> {
  await runFfmpeg([
    "-i",
    inputPath,
    "-vf",
    `scale=${opts.width}:${opts.height},fps=${opts.fps}`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(["-i", inputPath, "-vn", "-c:a", "libmp3lame", "-q:a", "4", outputPath]);
}

/**
 * Détection de coupes par changement de plan (filtre `select='gt(scene,…)'`)
 * — sert à mesurer `average_cut_duration` sur une vidéo de référence sans
 * aucun modèle IA (Agent 10 / style profile, packages/agents/src/style-extractor.ts).
 */
export async function detectSceneCuts(inputPath: string, threshold = 0.35): Promise<number[]> {
  let stderr = "";
  try {
    const res = await runFfmpeg(["-i", inputPath, "-vf", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"]);
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
  await runFfmpeg([
    "-i",
    inputPath,
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    outputPath,
  ]);
}

import { spawn } from "node:child_process";
import type { MediaAnalysis, MediaHighlight } from "@video-editor/shared-types";
import { detectSilence, nonSilentSegments, volumeStats } from "@video-editor/render/dist/ffmpeg.js";

/**
 * Pré-analyse d'une vidéo faite UNE fois à l'import (et stockée), pour que
 * chaque montage suivant choisisse ses rushs sans retélécharger ni
 * réanalyser 1 000 fichiers. 100 % déterministe (ffmpeg) : exposition,
 * mouvement, changements de plan, présence de voix — et des fenêtres
 * « utiles » (highlights) que le montage peut extraire directement.
 * L'analyse fine (transcription, scoring par segment) reste celle du
 * pipeline de montage existant, sur les seuls rushs retenus.
 */

interface FrameSample {
  t: number;
  yavg: number;
  scene: number;
}

function runFfmpegStderr(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-nostats", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString();
      // Garde-fou mémoire sur les très longues vidéos.
      if (stderr.length > 64 * 1024 * 1024) child.kill("SIGKILL");
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", () => {
      clearTimeout(timer);
      resolve(stderr);
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(stderr);
    });
  });
}

/**
 * Un seul décodage échantillonné (2 images/s en 320 px, ou images-clés
 * seules au-delà d'une minute) → luminosité + score de changement de plan
 * par instant.
 */
export async function sampleFrames(path: string, durationSec: number): Promise<FrameSample[]> {
  const longVideo = durationSec > 60;
  const vf = `${longVideo ? "" : "fps=2,"}scale=320:-2,signalstats,select='gte(scene\\,0)',metadata=print`;
  const args = [...(longVideo ? ["-skip_frame", "nokey"] : []), "-i", path, "-an", "-vf", vf, "-f", "null", "-"];
  const stderr = await runFfmpegStderr(args, Math.max(120000, durationSec * 2000));
  const samples: FrameSample[] = [];
  let cur: Partial<FrameSample> | null = null;
  for (const line of stderr.split("\n")) {
    const pts = /pts_time:([\d.]+)/.exec(line);
    if (pts) {
      if (cur && cur.t !== undefined) samples.push({ t: cur.t, yavg: cur.yavg ?? 128, scene: cur.scene ?? 0 });
      cur = { t: parseFloat(pts[1]!) };
      continue;
    }
    if (!cur) continue;
    const y = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(line);
    if (y) cur.yavg = parseFloat(y[1]!);
    const s = /lavfi\.scene_score=([\d.]+)/.exec(line);
    if (s) cur.scene = parseFloat(s[1]!);
  }
  if (cur && cur.t !== undefined) samples.push({ t: cur.t, yavg: cur.yavg ?? 128, scene: cur.scene ?? 0 });
  return samples;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function exposureFactor(yavg: number): number {
  if (yavg < 40) return 0.2;
  if (yavg > 235) return 0.45;
  if (yavg < 60) return 0.7;
  if (yavg > 210) return 0.75;
  return 1;
}

function resolutionFactor(width = 0, height = 0): number {
  const maxSide = Math.max(width, height);
  if (maxSide >= 1920) return 1;
  if (maxSide >= 1280) return 0.85;
  if (maxSide >= 854) return 0.7;
  return 0.5;
}

function durationFactor(d: number): number {
  if (d < 1) return 0.2;
  if (d < 3) return 0.6;
  if (d <= 180) return 1;
  return 0.85;
}

/** Mouvement : plan figé un peu pénalisé, plan très agité (secousses) davantage. */
function motionFactor(motion: number): number {
  if (motion < 0.002) return 0.75;
  if (motion > 0.25) return 0.6;
  return 1;
}

const SCENE_CUT = 0.3;
const MAX_HIGHLIGHT_SEC = 8;
const MIN_HIGHLIGHT_SEC = 1.2;

function windowsFromCuts(duration: number, samples: FrameSample[]): { start: number; end: number }[] {
  const cuts = samples.filter((s) => s.scene >= SCENE_CUT).map((s) => s.t);
  const bounds = [0, ...cuts, duration];
  const out: { start: number; end: number }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    let start = bounds[i]!;
    const end = bounds[i + 1]!;
    // Découpe des plans longs en fenêtres ≤ MAX_HIGHLIGHT_SEC.
    while (end - start >= MIN_HIGHLIGHT_SEC) {
      const e = Math.min(end, start + MAX_HIGHLIGHT_SEC);
      out.push({ start, end: e });
      start = e;
    }
  }
  return out;
}

export async function analyzeVideo(path: string, info: { durationSec: number; width: number; height: number; hasAudio: boolean }): Promise<MediaAnalysis> {
  const notes: string[] = [];
  const duration = info.durationSec;
  const samples = await sampleFrames(path, duration);
  if (samples.length === 0) notes.push("échantillonnage image impossible — score basé sur la résolution et la durée");

  let speechRatio = 0;
  let meanVolumeDb: number | undefined;
  let voiced: { start: number; end: number }[] = [];
  if (info.hasAudio) {
    try {
      const silences = await detectSilence(path, { noiseDb: -35, minSilenceDurationSec: 0.6 });
      voiced = nonSilentSegments(duration, silences);
      speechRatio = clamp01(voiced.reduce((s, w) => s + (w.end - w.start), 0) / Math.max(0.001, duration));
      meanVolumeDb = (await volumeStats(path)).meanVolumeDb;
    } catch {
      notes.push("analyse audio impossible");
    }
  } else {
    notes.push("pas de piste audio");
  }

  const brightness = samples.length > 0 ? mean(samples.map((s) => s.yavg)) : 128;
  // Le 1er score de scène vaut toujours 0 (pas d'image précédente).
  const motion = samples.length > 1 ? mean(samples.slice(1).map((s) => s.scene)) : 0;
  const sceneCuts = samples.filter((s) => s.scene >= SCENE_CUT).length;
  const tooDark = brightness < 40;
  const tooBright = brightness > 235;
  if (tooDark) notes.push("vidéo très sombre");
  if (tooBright) notes.push("vidéo surexposée");

  const score = clamp01(
    exposureFactor(brightness) * 0.35 +
      resolutionFactor(info.width, info.height) * 0.2 +
      durationFactor(duration) * 0.15 +
      motionFactor(motion) * 0.15 +
      (speechRatio >= 0.3 ? 1 : 0.85) * 0.15
  );

  // Fenêtres candidates : phrases (rush parlé) ou plans (rush muet/ambiance).
  const speechDriven = speechRatio >= 0.3 && voiced.length > 0;
  const candidates = speechDriven
    ? voiced.flatMap((w) => {
        const parts: { start: number; end: number }[] = [];
        let s = w.start;
        while (w.end - s >= MIN_HIGHLIGHT_SEC) {
          const e = Math.min(w.end, s + MAX_HIGHLIGHT_SEC);
          parts.push({ start: s, end: e });
          s = e;
        }
        return parts;
      })
    : windowsFromCuts(duration, samples);

  const scored: MediaHighlight[] = candidates.map((w) => {
    const inWin = samples.filter((s) => s.t >= w.start && s.t < w.end);
    const exp = inWin.length > 0 ? mean(inWin.map((s) => exposureFactor(s.yavg))) : exposureFactor(brightness);
    const mot = inWin.length > 1 ? mean(inWin.slice(1).map((s) => s.scene)) : motion;
    const len = w.end - w.start;
    const lenScore = len >= 2.5 ? 1 : 0.7;
    const s = clamp01(exp * 0.55 + motionFactor(mot) * 0.25 + lenScore * 0.2);
    return {
      start: Number(w.start.toFixed(2)),
      end: Number(w.end.toFixed(2)),
      score: Number(s.toFixed(3)),
      reason: speechDriven ? "phrase parlée bien exposée" : "plan stable bien exposé",
    };
  });
  const highlights = scored
    .filter((h) => h.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.start - b.start);

  return {
    score: Number(score.toFixed(3)),
    brightness: Number(brightness.toFixed(1)),
    tooDark,
    tooBright,
    speechRatio: Number(speechRatio.toFixed(3)),
    meanVolumeDb,
    sceneCuts,
    motion: Number(motion.toFixed(4)),
    highlights,
    notes,
  };
}

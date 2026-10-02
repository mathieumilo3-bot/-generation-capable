/**
 * Benchmark de la puissance de rendu Remotion (§ objectif rendu).
 *
 * Rend EXACTEMENT la même composition (1080×1920, ~45 s → 1350 frames,
 * mêmes sous-titres, mêmes zooms) à deux niveaux de concurrence et mesure,
 * pour de vrai (aucune simulation) :
 *   - durée de rendu, frames rendues, FPS moyen
 *   - utilisation CPU système (%) échantillonnée via /proc/stat
 *   - pic de RAM utilisée via /proc/meminfo (MemAvailable)
 *   - concurrence réellement appliquée
 *
 * But : prouver que la concurrence utilise réellement plus de CPU et rend
 * les frames EN PARALLÈLE (donc plus vite). Sur une machine 16 vCPU
 * performance, la concurrence auto vaut 16 ; ici (moins de cœurs) on
 * compare concurrence=1 vs auto pour démontrer le même mécanisme.
 *
 * Usage : node packages/render/dist/bench-remotion.js [durationSec]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderHabillage, resolveRenderConcurrency } from "./remotion.js";

const execFileAsync = promisify(execFile);

function readCpu(): { total: number; idle: number } {
  const line = readFileSync("/proc/stat", "utf-8").split("\n")[0] ?? "";
  const p = line.trim().split(/\s+/).slice(1).map((x) => Number(x) || 0);
  const idle = (p[3] ?? 0) + (p[4] ?? 0); // idle + iowait
  const total = p.reduce((a, b) => a + b, 0);
  return { total, idle };
}

function memAvailableMb(): number {
  try {
    const m = /MemAvailable:\s+(\d+)\s+kB/.exec(readFileSync("/proc/meminfo", "utf-8"));
    if (m) return Math.round(Number.parseInt(m[1]!, 10) / 1024);
  } catch {
    /* noop */
  }
  return Math.round(os.freemem() / (1024 * 1024));
}

/** Échantillonne CPU% et RAM utilisée pendant une opération asynchrone. */
class ResourceSampler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastCpu = readCpu();
  private cpuPcts: number[] = [];
  private minAvailMb = memAvailableMb();
  private readonly totalMemMb = Math.round(os.totalmem() / (1024 * 1024));

  start(intervalMs = 500): void {
    this.lastCpu = readCpu();
    this.timer = setInterval(() => {
      const now = readCpu();
      const dTotal = now.total - this.lastCpu.total;
      const dIdle = now.idle - this.lastCpu.idle;
      if (dTotal > 0) this.cpuPcts.push(Math.max(0, Math.min(100, (1 - dIdle / dTotal) * 100)));
      this.lastCpu = now;
      this.minAvailMb = Math.min(this.minAvailMb, memAvailableMb());
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): { avgCpuPct: number; peakCpuPct: number; peakRamUsedMb: number } {
    if (this.timer) clearInterval(this.timer);
    const avg = this.cpuPcts.length ? this.cpuPcts.reduce((a, b) => a + b, 0) / this.cpuPcts.length : 0;
    const peak = this.cpuPcts.length ? Math.max(...this.cpuPcts) : 0;
    return {
      avgCpuPct: Math.round(avg),
      peakCpuPct: Math.round(peak),
      peakRamUsedMb: this.totalMemMb - this.minAvailMb,
    };
  }
}

async function ffmpeg(args: string[]): Promise<void> {
  await execFileAsync("ffmpeg", ["-hide_banner", "-y", ...args], { maxBuffer: 1024 * 1024 * 64 });
}

/** Construit des sous-titres + zooms représentatifs sur toute la durée. */
function buildComposition(fps: number, durationInFrames: number) {
  const captions: { startFrame: number; endFrame: number; words: { word: string; startFrame: number; endFrame: number; emphasize: boolean }[] }[] = [];
  const cueLen = Math.round(fps * 2); // une phrase toutes les ~2 s
  const sample = ["Voici", "le", "moment", "clé", "à", "ne", "pas", "rater"];
  for (let f = 0; f + cueLen < durationInFrames; f += cueLen) {
    const wordCount = 4;
    const per = Math.floor(cueLen / wordCount);
    const words = Array.from({ length: wordCount }, (_, i) => ({
      word: sample[(f / cueLen + i) % sample.length]!,
      startFrame: f + i * per,
      endFrame: f + (i + 1) * per,
      emphasize: i === 1,
    }));
    captions.push({ startFrame: f, endFrame: f + cueLen, words });
  }
  const zoomWindows = [] as { startFrame: number; endFrame: number; scale: number }[];
  for (let f = 0; f + fps * 5 < durationInFrames; f += Math.round(fps * 7)) {
    zoomWindows.push({ startFrame: f, endFrame: f + Math.round(fps * 3), scale: 1.15 });
  }
  return { captions, zoomWindows };
}

async function main(): Promise<void> {
  const durationSec = Number(process.argv[2] ?? 45);
  const fps = 30;
  const width = 1080;
  const height = 1920;
  const durationInFrames = durationSec * fps;

  const dir = await mkdtemp(join(tmpdir(), "ve-bench-"));
  process.env.VIDEO_EDITOR_STORAGE_ROOT = dir; // Remotion sert depuis ici
  const basePath = join(dir, "base.mp4");

  console.log(`=== Benchmark rendu Remotion — ${durationSec}s @ ${fps}fps = ${durationInFrames} frames, ${width}x${height} ===`);
  console.log(`Machine : ${os.cpus().length} vCPU · ${Math.round(os.totalmem() / (1024 * 1024 * 1024))} Go RAM`);
  console.log(`Concurrence AUTO calculée : ${resolveRenderConcurrency().reason}\n`);

  console.log("Génération de la vidéo de base (1080x1920 + audio)…");
  await ffmpeg([
    "-f", "lavfi", "-i", `testsrc2=size=${width}x${height}:rate=${fps}:duration=${durationSec}`,
    "-f", "lavfi", "-i", `sine=frequency=440:duration=${durationSec}`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", basePath,
  ]);

  const { captions, zoomWindows } = buildComposition(fps, durationInFrames);
  console.log(`Composition : ${captions.length} sous-titres, ${zoomWindows.length} zooms\n`);

  const scenarios = [
    { label: "concurrence=1 (séquentiel)", concurrency: 1 },
    { label: "concurrence=AUTO (parallèle)", concurrency: null as number | null },
  ];

  const results: {
    label: string; concurrency: number; durationMs: number; frames: number; fps: number;
    avgCpuPct: number; peakCpuPct: number; peakRamUsedMb: number;
  }[] = [];

  for (const sc of scenarios) {
    console.log(`--- Rendu ${sc.label} ---`);
    const sampler = new ResourceSampler();
    sampler.start(500);
    const t0 = Date.now();
    let lastPct = -10;
    const r = await renderHabillage({
      videoSrc: basePath,
      outputPath: join(dir, `out_${sc.concurrency ?? "auto"}.mp4`),
      durationInFrames, fps, width, height,
      captions, zoomWindows, captionStyle: "bold_dynamic",
      concurrency: sc.concurrency,
      onProgress: ({ renderedFrames, totalFrames }) => {
        const pct = Math.round((renderedFrames / totalFrames) * 100);
        if (pct >= lastPct + 20) { console.log(`  Export — ${pct}% (${renderedFrames}/${totalFrames} frames)`); lastPct = pct; }
      },
    });
    const durationMs = Date.now() - t0;
    const res = sampler.stop();
    const avgFps = Math.round((r.framesRendered / durationMs) * 1000 * 10) / 10;
    results.push({ label: sc.label, concurrency: r.concurrency, durationMs, frames: r.framesRendered, fps: avgFps, ...res });
    console.log(`  → ${(durationMs / 1000).toFixed(1)}s · ${avgFps} fps moyen · CPU moy ${res.avgCpuPct}% (pic ${res.peakCpuPct}%) · RAM pic ${(res.peakRamUsedMb / 1024).toFixed(1)} Go · concurrence ${r.concurrency}\n`);
  }

  console.log("=== RÉSULTATS ===");
  console.log("scénario                       | concur | durée   | fps moy | CPU moy | CPU pic | RAM pic");
  console.log("-------------------------------|--------|---------|---------|---------|---------|--------");
  for (const r of results) {
    console.log(
      `${r.label.padEnd(30)} | ${String(r.concurrency).padStart(6)} | ${(r.durationMs / 1000).toFixed(1).padStart(6)}s | ${String(r.fps).padStart(7)} | ${String(r.avgCpuPct + "%").padStart(7)} | ${String(r.peakCpuPct + "%").padStart(7)} | ${(r.peakRamUsedMb / 1024).toFixed(1)}Go`
    );
  }
  if (results.length === 2) {
    const [seq, par] = results;
    const speedup = seq!.durationMs / par!.durationMs;
    const cpuGain = par!.avgCpuPct - seq!.avgCpuPct;
    console.log(`\nGain parallélisme : ×${speedup.toFixed(2)} plus rapide · +${cpuGain} points de CPU utilisé · aucun OOM (RAM pic ${(Math.max(seq!.peakRamUsedMb, par!.peakRamUsedMb) / 1024).toFixed(1)} Go).`);
  }
}

main().catch((err) => {
  console.error("Benchmark échoué:", err);
  process.exit(1);
});

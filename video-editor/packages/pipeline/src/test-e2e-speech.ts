/**
 * TEST VIDÉO RÉEL AVEC PAROLE — STT local → sous-titres → rendu final.
 *
 * Construit un rush vertical à partir d'images réelles (fichier vidéo
 * fourni) et de VRAIES voix humaines (fichiers audio fournis), séparées par
 * des silences, puis lance le pipeline complet. Vérifie ensuite que :
 *   - la transcription locale (Parakeet, gratuite) a produit les sous-titres ;
 *   - les sous-titres sont synchronisés : on re-transcrit la vidéo FINALE et
 *     chaque mot sous-titré doit tomber au moment où il est prononcé ;
 *   - le rendu passe par l'habillage FFmpeg (pas le repli Remotion).
 *
 * Usage :
 *   VIDEO_EDITOR_STT_MODEL_DIR=… node dist/test-e2e-speech.js <video.mp4> <voix1.wav> [voix2.wav …]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { Db } from "@video-editor/db";
import { ModelRouter } from "@video-editor/model-router";
import { probe } from "@video-editor/render";
import { runPipeline } from "./run-pipeline.js";

const execFileAsync = promisify(execFile);
async function ffmpeg(args: string[]): Promise<void> {
  await execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 1024 * 1024 * 64 });
}

let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION ÉCHOUÉE: ${msg}`);
  passed++;
  console.log(`  ✓ ${msg}`);
}

const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");

async function main(): Promise<void> {
  const [video, ...voices] = process.argv.slice(2);
  if (!video || !existsSync(video) || voices.length === 0 || !voices.every((v) => existsSync(v))) {
    console.error("Usage : node dist/test-e2e-speech.js <video.mp4> <voix1.wav> [voix2.wav …]");
    process.exit(2);
  }
  console.log("=== TEST VIDÉO RÉEL AVEC PAROLE — STT local → sous-titres → rendu ===");
  const dir = mkdtempSync(join(tmpdir(), "ve-speech-"));
  process.env.VIDEO_EDITOR_STORAGE_ROOT = dir;
  const db = new Db(join(dir, "e2e.sqlite"));
  const router = new ModelRouter();
  assert(router.capabilities.stt, "un STT réel est disponible (modèle local)");

  const project = db.createProject({ userId: "t", title: "e2e-speech" });
  const rushPath = join(dir, project.id, "rushes", "parole.mp4");
  await mkdir(dirname(rushPath), { recursive: true });

  // Piste voix : 1,2 s de silence d'entrée, puis chaque prise suivie de 0,9 s de blanc.
  const voiceTrack = join(dir, "voix.wav");
  const inputs = voices.flatMap((v) => ["-i", v]);
  const pads = voices.map((_, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur=0.9[v${i}]`).join(";");
  await ffmpeg([
    ...inputs,
    "-filter_complex",
    `${pads};${voices.map((_, i) => `[v${i}]`).join("")}concat=n=${voices.length}:v=0:a=1,adelay=1200:all=1[o]`,
    "-map", "[o]", voiceTrack,
  ]);
  const voiceInfo = await probe(voiceTrack);

  await ffmpeg([
    "-stream_loop", "-1", "-i", video, "-i", voiceTrack,
    "-map", "0:v", "-map", "1:a", "-t", voiceInfo.durationSec.toFixed(2),
    "-vf", "crop='if(gt(a,9/16),ih*9/16,iw)':'if(gt(a,9/16),ih,iw*16/9)',scale=1080:1920,fps=30",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", rushPath,
  ]);
  const info = await probe(rushPath);
  console.log(`Rush : ${info.width}x${info.height}, ${info.durationSec.toFixed(1)}s, audio=${info.hasAudio}`);
  db.createRush({
    projectId: project.id, originalFilename: "parole.mp4", storagePath: rushPath,
    container: "mp4", codec: "h264", durationSec: info.durationSec, hasAudio: info.hasAudio,
  });

  // Référence : ce que dit vraiment la piste voix.
  const reference = await router.stt.transcribe(voiceTrack);
  console.log(`Référence STT : « ${reference.data.text} »`);

  const t0 = Date.now();
  const result = await runPipeline(db, router, { projectId: project.id, rawBriefText: "Reel dynamique avec sous-titres pour Instagram" });
  const pipelineSec = (Date.now() - t0) / 1000;
  const bp = result.editBlueprint;
  const capWords = bp.captions.flatMap((c) => c.words);
  console.log(`\nPipeline : ${pipelineSec.toFixed(1)}s — ${bp.clips.length} plans, ${bp.captions.length} cues, ${capWords.length} mots sous-titrés`);
  for (const c of bp.captions) console.log(`  [${c.timelineStart.toFixed(2)}–${c.timelineEnd.toFixed(2)}] ${c.text}`);

  const out = result.finalRender.filePath!;
  const finalInfo = await probe(out);
  console.log(`Rendu final : ${out}\n  ${finalInfo.width}x${finalInfo.height}, ${finalInfo.durationSec.toFixed(1)}s`);
  console.log("Scorecard QC :", JSON.stringify({ scores: result.qcReport.scores, passed: result.qcReport.passed }));

  // Re-transcription de la vidéo FINALE : vérité terrain du timing.
  const heard = (await router.stt.transcribe(out)).data.words;
  // Pour chaque mot sous-titré : le même mot entendu le plus proche dans le temps (±1,5 s).
  const deltas: number[] = [];
  const missed: string[] = [];
  for (const w of capWords) {
    const k = norm(w.word);
    const near = heard.filter((h) => norm(h.word) === k && Math.abs(h.start - w.start) <= 1.5);
    if (near.length === 0) {
      missed.push(w.word);
      continue;
    }
    deltas.push(Math.min(...near.map((h) => Math.abs(h.start - w.start))));
  }
  if (missed.length) console.log(`Mots sous-titrés non réentendus : ${missed.join(", ")}`);
  deltas.sort((a, b) => a - b);
  const median = deltas[Math.floor(deltas.length / 2)] ?? Infinity;
  const p90 = deltas[Math.floor(deltas.length * 0.9)] ?? Infinity;
  console.log(`Synchro : ${deltas.length}/${capWords.length} mots retrouvés, écart médian ${median.toFixed(3)}s, p90 ${p90.toFixed(3)}s`);

  console.log("\n--- VÉRIFICATIONS ---");
  assert(bp.captions.length > 0, "des sous-titres ont été produits à partir de la vraie voix");
  assert(capWords.length >= reference.data.words.length * 0.6, `les sous-titres couvrent la parole (${capWords.length}/${reference.data.words.length} mots)`);
  assert(deltas.length >= capWords.length * 0.8, "≥ 80 % des mots sous-titrés sont entendus dans la vidéo finale");
  assert(median <= 0.15 && p90 <= 0.35, `sous-titres synchronisés (médian ${median.toFixed(3)}s ≤ 0,15 ; p90 ${p90.toFixed(3)}s ≤ 0,35)`);
  assert(finalInfo.height === 1920 && finalInfo.width === 1080, "format vertical 1080x1920");
  assert(finalInfo.videoCodec === "h264" && finalInfo.hasAudio, "MP4 valide (h264 + audio)");
  for (const w of result.warnings) console.log(`  (avertissement) ${w}`);
  assert(!result.warnings.some((w) => /Remotion|hybrid/i.test(w)), "habillage FFmpeg utilisé, sans repli");

  // Planche de contrôle visuel : 4 images réparties sur la vidéo.
  const sheet = join(dir, "planche.png");
  const n = 4;
  const sel = Array.from({ length: n }, (_, i) => `lt(prev_pts*TB\\,${((finalInfo.durationSec * (i + 0.5)) / n).toFixed(2)})*gte(pts*TB\\,${((finalInfo.durationSec * (i + 0.5)) / n).toFixed(2)})`).join("+");
  await ffmpeg(["-i", out, "-vf", `select='${sel}',scale=270:480,tile=${n}x1`, "-frames:v", "1", "-fps_mode", "vfr", sheet]);
  console.log(`Planche : ${sheet}`);

  console.log(`\n✅ OK — ${passed} assertions passées`);
  db.close();
}

main().catch((err) => {
  console.error(`\n❌ ÉCHEC : ${(err as Error).message}`);
  process.exit(1);
});

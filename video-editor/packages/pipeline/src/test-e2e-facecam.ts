/**
 * TEST VIDÉO RÉEL (§19, §25) — rush vertical facecam ~12s + brief SANS durée.
 *
 * Prouve de bout en bout, avec un VRAI rendu (FFmpeg + Remotion) :
 *   - la vidéo finale fait ≈ la durée du contenu, JAMAIS 45s ;
 *   - le montage est vertical et valide ;
 *   - le résumé éditorial expose de vraies décisions.
 *
 * Le rush est fabriqué depuis un fichier source réel passé en argument, ou
 * généré synthétiquement (facecam ~12s) si aucun n'est fourni — dans les
 * deux cas c'est un vrai .mp4 analysé par le pipeline, rien de simulé.
 *
 * Usage : node dist/test-e2e-facecam.js [chemin_source.mp4]
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
  await execFileAsync("ffmpeg", ["-hide_banner", "-y", ...args], { maxBuffer: 1024 * 1024 * 64 });
}

let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION ÉCHOUÉE: ${msg}`);
  passed++;
  console.log(`  ✓ ${msg}`);
}

async function main(): Promise<void> {
  console.log("=== TEST VIDÉO RÉEL — facecam ~12s, brief SANS durée ===");
  const dir = mkdtempSync(join(tmpdir(), "ve-e2e-"));
  process.env.VIDEO_EDITOR_STORAGE_ROOT = dir;
  const db = new Db(join(dir, "e2e.sqlite"));
  const router = new ModelRouter();

  const project = db.createProject({ userId: "t", title: "e2e-facecam" });
  const rushPath = join(dir, project.id, "rushes", "facecam.mp4");
  await mkdir(dirname(rushPath), { recursive: true });

  const source = process.argv[2];
  if (source && existsSync(source)) {
    // Rush réel : 12s extraits, recadrés en vertical 1080x1920, audio conservé.
    console.log(`Rush depuis source réelle : ${source}`);
    await ffmpeg([
      "-ss", "0", "-t", "12", "-i", source,
      "-vf", "crop='if(gt(a,9/16),ih*9/16,iw)':'if(gt(a,9/16),ih,iw*16/9)',scale=1080:1920",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", rushPath,
    ]);
  } else {
    // Facecam synthétique ~12s : mire verticale + parole entrecoupée de silences
    // (donne au Video Analyzer de vrais segments à scorer/couper).
    console.log("Rush synthétique facecam ~12s (aucune source fournie)");
    await ffmpeg([
      "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=12",
      "-f", "lavfi", "-i",
      "sine=frequency=330:duration=12,volume=enable='between(t,0,0.6)':volume=0,volume=enable='between(t,3.2,3.9)':volume=0,volume=enable='between(t,7.1,7.8)':volume=0,volume=enable='between(t,10.5,12)':volume=0",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-c:a", "aac", "-shortest", rushPath,
    ]);
  }

  const info = await probe(rushPath);
  console.log(`Rush : ${info.width}x${info.height}, ${info.durationSec.toFixed(1)}s, audio=${info.hasAudio}`);
  db.createRush({
    projectId: project.id, originalFilename: "facecam.mp4", storagePath: rushPath,
    container: "mp4", codec: info.videoCodec === "h264" ? "h264" : "unknown",
    durationSec: info.durationSec, hasAudio: info.hasAudio,
  });

  // BRIEF SANS AUCUNE DURÉE — le point du test.
  const brief = "Fais-moi un montage dynamique et professionnel";
  console.log(`\nBrief (sans durée) : « ${brief} »\n--- Pipeline ---`);
  const result = await runPipeline(db, router, { projectId: project.id, rawBriefText: brief });

  console.log("\n--- RÉSUMÉ ÉDITORIAL ---");
  for (const line of result.editorialSummary) console.log("  " + line);

  const finalInfo = await probe(result.finalRender.filePath!);
  console.log(`\nRendu final : ${finalInfo.width}x${finalInfo.height}, ${finalInfo.durationSec.toFixed(1)}s`);

  console.log("\n--- VÉRIFICATIONS ---");
  assert(result.briefSpec.targetDurationSec === undefined, "aucune durée n'a été inventée dans le brief (pas de 45s)");
  assert(finalInfo.durationSec <= 14, `durée finale (${finalInfo.durationSec.toFixed(1)}s) ≈ contenu, JAMAIS 45s`);
  assert(finalInfo.durationSec >= 3, "la vidéo n'est pas vide");
  assert(finalInfo.height > finalInfo.width, "format vertical");
  assert(finalInfo.videoCodec === "h264" && finalInfo.hasAudio, "MP4 valide (vidéo h264 + audio)");
  assert(result.editorialSummary.length >= 8, "un résumé éditorial exploitable est produit");

  console.log(`\n✅ OK — ${passed} assertions passées`);
  db.close();
}

main().catch((err) => {
  console.error(`\n❌ ÉCHEC : ${(err as Error).message}`);
  process.exit(1);
});

/**
 * Worker mock pour le test d'intégration du scheduler (test-queue.ts).
 * Se comporte comme cli-run-project.js — lit VIDEO_EDITOR_JOB_ID /
 * VIDEO_EDITOR_DB_PATH, met à jour la progression, puis marque le job
 * terminé — mais SANS le pipeline réel (pas de FFmpeg/Remotion), pour un
 * test rapide et déterministe de la mécanique de queue/concurrence.
 *
 * Comportement paramétrable par env pour exercer les cas d'échec :
 *   MOCK_BEHAVIOR=complete (défaut) | crash | crash_first | hang
 *   - crash       : sort en erreur à chaque essai
 *   - crash_first : crash tant que attempts <= 1, réussit ensuite
 *                   (déterministe, sans course sur l'env)
 */
import { Db } from "@video-editor/db";

async function main(): Promise<void> {
  const jobId = process.env.VIDEO_EDITOR_JOB_ID;
  const dbPath = process.env.VIDEO_EDITOR_DB_PATH;
  const behavior = process.env.MOCK_BEHAVIOR ?? "complete";
  if (!jobId || !dbPath) throw new Error("VIDEO_EDITOR_JOB_ID et VIDEO_EDITOR_DB_PATH requis");

  const db = new Db(dbPath);
  const current = db.getRenderJob(jobId);

  db.updateRenderJobProgress(jobId, { status: "rendering", progress: 50, workerPid: process.pid });

  const shouldCrash = behavior === "crash" || (behavior === "crash_first" && (current?.attempts ?? 0) <= 1);
  if (shouldCrash) {
    // Sort en erreur SANS se marquer terminal → le scheduler doit trancher.
    db.close();
    process.exit(1);
  }
  if (behavior === "hang") {
    // Ne se termine jamais (le test le tue). Garde le process vivant.
    setInterval(() => undefined, 1000);
    return;
  }

  await new Promise((r) => setTimeout(r, 250));
  db.completeRenderJob(jobId, `/fake/output/${jobId}.mp4`);
  db.close();
}

main().catch((err) => {
  console.error("mock worker error:", err);
  process.exit(1);
});

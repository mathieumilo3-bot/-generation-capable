/**
 * Point d'entrée spawné en sous-processus par le scheduler
 * (@video-editor/orchestrator) — jamais importé statiquement par le
 * serveur Next.js. Raison : @video-editor/render entraîne
 * @remotion/bundler (esbuild + binaires natifs rspack), que le bundler
 * webpack de Next ne sait pas exclure proprement d'une route API en
 * pratique (constaté empiriquement). Un worker séparé est de toute façon
 * l'architecture cible (§4, §9 du dossier stratégique : jobs asynchrones
 * isolés, pas de traitement lourd dans le process web).
 *
 * Ce worker met à jour la progression RÉELLE de SON job de render_queue
 * (status, %, étape courante, ETA) — le scheduler, lui, gère le heartbeat
 * de liveness et le sort d'un worker qui meurt sans se marquer.
 *
 * Usage: node cli-run-project.js '<RunPipelineInput JSON>'
 * Env optionnel : VIDEO_EDITOR_JOB_ID, VIDEO_EDITOR_RENDER_PROFILE
 */
import { Db } from "@video-editor/db";
import { ModelRouter } from "@video-editor/model-router";
import {
  PIPELINE_STAGES,
  STAGE_LABEL_FR,
  STAGE_TO_JOB_STATUS,
  computeProgress,
  type PipelineStage,
  type RenderProfile,
} from "@video-editor/shared-types";
import { runPipeline, type RunPipelineInput } from "./run-pipeline.js";

async function main(): Promise<void> {
  const raw = process.argv[2];
  if (!raw) throw new Error("Usage: cli-run-project.js '<RunPipelineInput JSON>'");
  const input = JSON.parse(raw) as RunPipelineInput;

  const storageRoot = process.env.VIDEO_EDITOR_STORAGE_ROOT;
  if (!storageRoot) throw new Error("VIDEO_EDITOR_STORAGE_ROOT doit être défini par l'appelant.");
  const dbPath = process.env.VIDEO_EDITOR_DB_PATH ?? `${storageRoot}/web.sqlite`;
  const jobId = process.env.VIDEO_EDITOR_JOB_ID;
  const profile = (process.env.VIDEO_EDITOR_RENDER_PROFILE as RenderProfile | undefined) ?? undefined;
  if (profile) input.profile = profile;

  const db = new Db(dbPath);
  const router = new ModelRouter();

  // Progression réelle : on cumule le poids des étapes terminées (pas
  // "index/total" — voir stage-progress.ts) et on dérive une ETA honnête
  // depuis le temps réellement écoulé, jamais une estimation inventée.
  const completed = new Set<PipelineStage>();
  const startedAt = Date.now();

  const reportProgress = (stage: PipelineStage, phase: "start" | "done"): void => {
    if (!jobId) return;
    if (phase === "done") completed.add(stage);
    const current = phase === "start" ? stage : undefined;
    const progress = computeProgress(completed, current);
    const elapsed = Date.now() - startedAt;
    const eta = progress > 3 && progress < 100 ? Math.round((elapsed * (100 - progress)) / progress) : progress >= 100 ? 0 : null;
    try {
      db.updateRenderJobProgress(jobId, {
        status: STAGE_TO_JOB_STATUS[stage],
        progress,
        currentStage: STAGE_LABEL_FR[stage],
        estimatedRemainingMs: eta,
        workerPid: process.pid,
      });
    } catch (err) {
      // Ne jamais laisser une écriture de progression casser le rendu.
      console.warn(`[worker] maj progression échouée: ${(err as Error).message}`);
    }
  };

  if (jobId) {
    db.updateRenderJobProgress(jobId, { status: "preparing", progress: 0, workerPid: process.pid });
  }

  try {
    const result = await runPipeline(db, router, input, (stage, status) => {
      console.log(`[${input.projectId}] ${stage}: ${status}`);
      if (status === "start") reportProgress(stage as PipelineStage, "start");
      else if (status === "done") reportProgress(stage as PipelineStage, "done");
    });

    if (jobId) {
      // Sécurité : marquer toutes les étapes terminées → 100%.
      for (const s of PIPELINE_STAGES) completed.add(s);
      db.completeRenderJob(jobId, result.finalRender.filePath);
    }
    console.log(`[${input.projectId}] Pipeline terminé avec succès`);
  } catch (err) {
    const msg = (err as Error).message;
    if (jobId) {
      const requeued = db.failRenderJob(jobId, msg);
      console.error(`[${input.projectId}] Pipeline échoué: ${msg} — ${requeued ? "sera réessayé" : "échec définitif"}`);
    } else {
      console.error(`[${input.projectId}] Pipeline échoué: ${msg}`);
    }
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error("cli-run-project a échoué:", err);
  process.exitCode = 1;
});

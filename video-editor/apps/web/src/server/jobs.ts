import { join } from "node:path";
import type { RunPipelineInput } from "@video-editor/pipeline";
import type { RenderJob, RenderJobPriority } from "@video-editor/shared-types";
import { ensureSchedulerStarted, getRunningScheduler, loadFactoryConfig } from "@video-editor/orchestrator";
import { resolveStorageRoot } from "./storage";
import { getDb, getDbPath } from "./db";

/**
 * Le montage tourne en sous-processus worker piloté par le scheduler
 * (@video-editor/orchestrator) — jamais dans le process web. Ce fichier
 * est la couture entre l'API HTTP et la factory : il met un projet en
 * file (queue persistante en base, §2) et s'assure que le scheduler
 * in-process tourne (§4). La concurrence est décidée dynamiquement par le
 * scheduler (§3), pas ici.
 *
 * On n'importe PAS @video-editor/render / pipeline runtime ici : le
 * scheduler ne fait que spawn le CLI, donc aucune dépendance lourde
 * (@remotion/bundler) n'entre dans le bundle webpack du serveur Next.
 */
const PIPELINE_CLI = join(process.cwd(), "..", "..", "packages", "pipeline", "dist", "cli-run-project.js");

/** Démarre (une seule fois) le scheduler in-process, branché sur la base web. */
function ensureScheduler() {
  return ensureSchedulerStarted({
    db: getDb(),
    workerCliPath: PIPELINE_CLI,
    storageRoot: resolveStorageRoot(),
    dbPath: getDbPath(),
  });
}

/**
 * Met un projet en file de rendu. Idempotent par projet (§17 : trois
 * clics = un seul job) grâce au dédup au niveau base. Le scheduler
 * dispatchera dès qu'un worker est libre selon la capacité adaptative.
 */
export function startPipelineJob(input: RunPipelineInput, opts?: { priority?: RenderJobPriority }): RenderJob {
  const db = getDb();
  const config = loadFactoryConfig();
  const job = db.enqueueRenderJob({
    projectId: input.projectId,
    payload: JSON.stringify(input),
    priority: opts?.priority ?? 0,
    profile: config.renderProfile,
  });
  // Le projet passe "processing" dès la mise en file (l'UI montre "en
  // travail", pas "brouillon") — le worker écrasera avec ready/failed.
  db.setProjectStatus(input.projectId, "processing");
  ensureScheduler();
  return job;
}

/** Un projet a-t-il un job actif (en file ou en cours) ? */
export function isPipelineRunning(projectId: string): boolean {
  const job = getDb().getActiveRenderJobForProject(projectId);
  return job !== null;
}

/** État de file d'un projet (progress/ETA/étape/worker) pour l'UI. */
export function getProjectQueueJob(projectId: string): RenderJob | null {
  return getDb().getActiveRenderJobForProject(projectId);
}

/** Annule le job actif d'un projet (§18). Renvoie true si un job a été annulé. */
export function cancelProjectJob(projectId: string): boolean {
  const db = getDb();
  const job = db.getActiveRenderJobForProject(projectId);
  if (!job) return false;
  const scheduler = getRunningScheduler();
  if (scheduler) return scheduler.cancel(job.jobId);
  // Pas de scheduler dans ce process (cas limite) : annulation en base seule.
  db.cancelRenderJob(job.jobId);
  return true;
}

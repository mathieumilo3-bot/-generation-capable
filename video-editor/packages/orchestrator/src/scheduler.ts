/**
 * RenderScheduler : le worker-pool adaptatif (§4, §8, §23 du brief).
 *
 * Boucle unique qui, à chaque tick :
 *   1. maintient le heartbeat des workers qu'il pilote (liveness) ;
 *   2. reprend les jobs orphelins d'un scheduler mort (§28 recovery) ;
 *   3. calcule la capacité adaptative (§3) ;
 *   4. réclame atomiquement des jobs en file et lance un worker isolé par
 *      job, tant qu'il reste de la capacité.
 *
 * Chaque worker est un SOUS-PROCESSUS indépendant (spawn du même CLI
 * qu'aujourd'hui) : un crash worker n'affecte jamais un autre projet ni
 * le process web (§4). Le claim atomique en base (Db.claimNextRenderJob)
 * garantit qu'un job n'est jamais exécuté deux fois — y compris si
 * plusieurs schedulers tournent sur plusieurs machines contre la même
 * base (§23 scale horizontal : aucune réécriture de logique métier, on
 * ajoute juste des schedulers).
 *
 * Répartition de responsabilité claire :
 *   - le worker met à jour progress/status/ETA de SON job ;
 *   - le scheduler met à jour le heartbeat (il SAIT que le child est vivant)
 *     et tranche le sort d'un job dont le child meurt sans se marquer.
 * Les longues étapes de rendu (20 min) ne déclenchent donc pas de fausse
 * reprise : la liveness = "mon sous-processus est vivant", et les hangs
 * réels sont tués par les timeouts par étape de run-pipeline.ts.
 */

import { spawn, type ChildProcess } from "node:child_process";
import type { Db } from "@video-editor/db";
import type { ConcurrencyDecision, RenderJob } from "@video-editor/shared-types";
import { isTerminalStatus } from "@video-editor/shared-types";
import { loadFactoryConfig, type FactoryConfig } from "./config.js";
import { decideConcurrency } from "./adaptive-concurrency.js";

export interface SchedulerOptions {
  db: Db;
  /** Chemin absolu vers packages/pipeline/dist/cli-run-project.js. */
  workerCliPath: string;
  /** Racine de stockage passée aux workers (VIDEO_EDITOR_STORAGE_ROOT). */
  storageRoot: string;
  /** Chemin de la base passé aux workers (VIDEO_EDITOR_DB_PATH). */
  dbPath: string;
  config?: FactoryConfig;
  /** Identifiant de ce scheduler (utile en multi-machine). Défaut: hostname:pid. */
  workerId?: string;
  /** Requeue TOUT job "running" au démarrage (sûr en mono-machine). Défaut true. */
  recoverOnStart?: boolean;
}

export class RenderScheduler {
  private readonly db: Db;
  private readonly config: FactoryConfig;
  private readonly workerId: string;
  private readonly opts: SchedulerOptions;
  private readonly children = new Map<string, ChildProcess>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private lastDecision: ConcurrencyDecision | null = null;

  constructor(opts: SchedulerOptions) {
    this.opts = opts;
    this.db = opts.db;
    this.config = opts.config ?? loadFactoryConfig();
    this.workerId = opts.workerId ?? `${process.env.HOSTNAME ?? "local"}:${process.pid}`;
  }

  start(): void {
    if (this.timer) return;
    const recoverOnStart = this.opts.recoverOnStart ?? true;
    if (recoverOnStart) {
      // Les sous-processus ne survivent pas au process parent : tout job
      // encore "running" au démarrage a un worker mort → on le requeue.
      const recovered = this.db.recoverStaleRenderJobs(0);
      if (recovered.length > 0) {
        console.log(`[scheduler] Reprise au démarrage : ${recovered.length} job(s) remis en file`);
      }
    }
    console.log(`[scheduler] Démarré (workerId=${this.workerId}, intervalle=${this.config.schedulerIntervalMs}ms)`);
    this.timer = setInterval(() => void this.tick(), this.config.schedulerIntervalMs);
    // Ne pas empêcher le process de sortir si c'est le seul timer restant.
    this.timer.unref?.();
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getLastDecision(): ConcurrencyDecision | null {
    return this.lastDecision;
  }

  activeWorkerCount(): number {
    return this.children.size;
  }

  /**
   * Annule un job (§18). Tue le worker s'il tourne, nettoie l'état.
   * Renvoie true si le job existait et a été annulé.
   */
  cancel(jobId: string): boolean {
    const res = this.db.cancelRenderJob(jobId);
    if (!res) return false;
    const child = this.children.get(jobId);
    if (child && child.pid) {
      try {
        child.kill("SIGTERM");
        // Filet de sécurité : SIGKILL si le worker ignore SIGTERM.
        setTimeout(() => {
          if (this.children.has(jobId)) {
            try {
              child.kill("SIGKILL");
            } catch {
              /* déjà mort */
            }
          }
        }, 5000).unref?.();
      } catch {
        /* déjà mort */
      }
    }
    return true;
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      // 1. Heartbeat des workers vivants que CE scheduler pilote.
      for (const jobId of this.children.keys()) {
        this.db.updateRenderJobProgress(jobId, {});
      }

      // 2. Reprise des jobs orphelins (scheduler mort ailleurs).
      const recovered = this.db.recoverStaleRenderJobs(this.config.heartbeatStaleMs);
      if (recovered.length > 0) {
        console.log(`[scheduler] ${recovered.length} job(s) orphelin(s) repris`);
      }

      // 3. Capacité adaptative.
      const decision = decideConcurrency(this.config);
      this.lastDecision = decision;

      // 4. Dispatch tant qu'il reste de la capacité ET des jobs en file.
      while (this.children.size < decision.maxWorkers) {
        const job = this.db.claimNextRenderJob(this.workerId);
        if (!job) break; // file vide
        this.dispatch(job);
      }
    } catch (err) {
      console.error(`[scheduler] tick error: ${(err as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  private dispatch(job: RenderJob): void {
    const nodeArgs: string[] = [];
    if (this.config.workerMemoryLimitMb) {
      nodeArgs.push(`--max-old-space-size=${this.config.workerMemoryLimitMb}`);
    }
    const child = spawn(process.execPath, [...nodeArgs, this.opts.workerCliPath, job.payload], {
      env: {
        ...process.env,
        VIDEO_EDITOR_STORAGE_ROOT: this.opts.storageRoot,
        VIDEO_EDITOR_DB_PATH: this.opts.dbPath,
        VIDEO_EDITOR_JOB_ID: job.jobId,
        VIDEO_EDITOR_RENDER_PROFILE: job.profile,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.children.set(job.jobId, child);
    console.log(
      `[scheduler] Dispatch job ${job.jobId} (projet ${job.projectId}, essai ${job.attempts}, pid ${child.pid}) — ${this.children.size}/${this.lastDecision?.maxWorkers} workers`
    );

    child.stdout?.on("data", (chunk) => process.stdout.write(`[worker ${job.projectId}] ${chunk}`));
    child.stderr?.on("data", (chunk) => process.stderr.write(`[worker ${job.projectId}] ${chunk}`));

    child.on("exit", (code) => {
      this.children.delete(job.jobId);
      const fresh = this.db.getRenderJob(job.jobId);
      if (!fresh) return;
      if (isTerminalStatus(fresh.status)) {
        // Le worker s'est déjà marqué (completed/failed/cancelled) — rien à faire.
        return;
      }
      // Le worker est sorti sans se marquer terminal → crash / OOM / kill.
      const requeued = this.db.failRenderJob(
        job.jobId,
        `Worker sorti (code ${code}) sans terminer l'étape ${fresh.currentStage ?? "?"}`
      );
      console.warn(
        `[scheduler] Job ${job.jobId} interrompu (code ${code}) — ${requeued ? "remis en file" : "échec définitif"}`
      );
      if (!requeued) this.db.setProjectStatus(fresh.projectId, "failed");
      // Redispatch immédiat (une place s'est libérée / un job est reparti en file).
      void this.tick();
    });
  }
}

let singleton: RenderScheduler | null = null;

/**
 * Démarre (une seule fois par process) le scheduler in-process. C'est le
 * mode de déploiement mono-machine actuel : le serveur web héberge le
 * scheduler. Pour scaler horizontalement, lancer le même scheduler dans
 * des process/machines dédiés (voir scheduler-daemon.ts) — le claim
 * atomique en base rend l'ajout de schedulers sûr sans rien changer.
 */
export function ensureSchedulerStarted(opts: SchedulerOptions): RenderScheduler {
  if (!singleton) {
    singleton = new RenderScheduler(opts);
    singleton.start();
  }
  return singleton;
}

export function getRunningScheduler(): RenderScheduler | null {
  return singleton;
}

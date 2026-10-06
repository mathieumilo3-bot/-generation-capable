import { normalizeCapabilities } from "@app/domain";
import type { EngineClient } from "@app/video-engine";
import type { BlobStore } from "./blobs.ts";
import type { OrchestratorConfig } from "./config.ts";
import { runJob, type RunnerDeps } from "./job-runner.ts";
import type { Store } from "./store.ts";
import { sendPushes } from "./push.ts";

type Log = (level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) => void;
export const consoleLog: Log = (level, msg, data = {}) => console[level === "error" ? "error" : "log"](JSON.stringify({ level, msg, ...data, ts: new Date().toISOString() }));

export interface OrchestratorDeps {
  store: Store; engine: EngineClient; blobs: BlobStore; cfg: OrchestratorConfig; log?: Log;
  /** Tâches annexes optionnelles (e-mails, auto-reload…) exécutées périodiquement. */
  extras?: { name: string; everyMs: number; run: () => Promise<unknown> }[];
  runnerOverrides?: Partial<RunnerDeps>;
}

/** Boucle principale : réclame les jobs (bail), les exécute en parallèle (borné), et fait la maintenance. */
export class Orchestrator {
  private running = new Set<Promise<unknown>>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private stopping = false;
  private revisionCommands: string[] = [];
  private log: Log;

  constructor(private d: OrchestratorDeps) { this.log = d.log ?? consoleLog; }

  get inFlight(): number { return this.running.size; }

  /** Un passage de réclamation : démarre autant de jobs que la capacité le permet. */
  async claimOnce(): Promise<number> {
    let started = 0;
    while (!this.stopping && this.running.size < this.d.cfg.CONCURRENCY) {
      const job = await this.d.store.claim(this.d.cfg.WORKER_ID, this.d.cfg.LEASE_SECONDS);
      if (!job) break;
      started++;
      const p: Promise<unknown> = runJob(job, {
        store: this.d.store, engine: this.d.engine, blobs: this.d.blobs, cfg: this.d.cfg, log: this.log,
        revisionCommands: () => this.revisionCommands, ...this.d.runnerOverrides,
      }).catch(async (e) => {
        // Filet de sécurité : une exception inattendue ne doit jamais laisser un job bloqué ni un montant retenu.
        this.log("error", "exception non gérée dans runJob", { job: job.job_id, error: (e as Error).message });
        await this.d.store.fail({ jobId: job.job_id, code: "orchestrator_error", message: (e as Error).message, retryable: true }).catch(() => undefined);
      }).finally(() => this.running.delete(p));
      this.running.add(p);
    }
    return started;
  }

  async syncCapabilities(): Promise<void> {
    try {
      const caps = await this.d.engine.capabilities();
      // Garde-fou : une réponse incomplète ou absurde ne doit JAMAIS écraser les capacités publiées
      // (sinon un bug de la passerelle désactiverait toute la création de vidéos).
      const norm = normalizeCapabilities(caps);
      if (!Array.isArray(caps.aspect_ratios) || norm.aspect_ratios.length === 0 || typeof caps.revisions !== "object" || typeof caps.autonomous_creation !== "boolean") {
        this.log("error", "capacités du moteur invalides — conservation des capacités actuelles", { caps });
        return;
      }
      const rev = (caps.revisions ?? {}) as { commands?: string[] };
      this.revisionCommands = Array.isArray(rev.commands) ? rev.commands : [];
      const changed = await this.d.store.syncCapabilities(String((caps as { engine_version?: string }).engine_version ?? "engine"), caps);
      if (changed) this.log("info", "capacités du moteur mises à jour", { caps });
    } catch (e) { this.log("warn", "synchro des capacités impossible", { error: (e as Error).message }); }
  }

  async idle(): Promise<void> { while (this.running.size > 0) await Promise.allSettled([...this.running]); }

  /** Pour les tests : traite tout ce qui est en file puis rend la main. */
  async drain(maxRounds = 50): Promise<void> {
    for (let i = 0; i < maxRounds; i++) {
      const n = await this.claimOnce();
      await this.idle();
      if (n === 0) return;
    }
  }

  async start(): Promise<void> {
    await this.syncCapabilities();
    const every = (ms: number, fn: () => Promise<unknown>, name: string) =>
      this.timers.push(setInterval(() => { void fn().catch((e) => this.log("warn", `tâche ${name} en échec`, { error: (e as Error).message })); }, ms));
    every(this.d.cfg.POLL_MS, () => this.claimOnce(), "claim");
    every(30_000, () => this.d.store.requeueStale().then((n) => { if (n) this.log("warn", "jobs orphelins relancés", { n }); }), "stale");
    every(5_000, () => sendPushes(this.d.store, { log: this.log }), "push");
    every(5 * 60_000, () => this.syncCapabilities(), "capabilities");
    for (const x of this.d.extras ?? []) every(x.everyMs, x.run, x.name);
    this.log("info", "orchestrateur démarré", { worker: this.d.cfg.WORKER_ID, concurrency: this.d.cfg.CONCURRENCY });
  }

  /** Arrêt propre : plus de nouvelle réclamation, on laisse finir les jobs en cours (le bail couvre le reste). */
  async stop(graceMs = 60_000): Promise<void> {
    this.stopping = true;
    this.timers.forEach(clearInterval);
    await Promise.race([this.idle(), new Promise((r) => setTimeout(r, graceMs))]);
  }
}

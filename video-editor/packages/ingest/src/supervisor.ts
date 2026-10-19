import { spawn, type ChildProcess } from "node:child_process";
import type { Db } from "@video-editor/db";

export interface ImportSupervisorOptions {
  db: Db;
  /** Chemin absolu vers packages/ingest/dist/cli-import.js. */
  workerCliPath: string;
  storageRoot: string;
  dbPath: string;
  /** Imports simultanés (chacun télécharge déjà plusieurs fichiers en parallèle). */
  maxConcurrent?: number;
  intervalMs?: number;
  /** Heartbeat au-delà duquel un worker est déclaré mort. */
  staleMs?: number;
}

/**
 * Boucle de supervision des imports, sur le modèle du RenderScheduler :
 * réclame atomiquement les imports en file (ou dont la reprise
 * automatique est échue), lance un sous-processus isolé par import, et
 * reprend ceux dont le worker est mort (redémarrage serveur, OOM…).
 * Totalement séparé de la file de rendu : un import de 1 000 vidéos ne
 * bloque jamais un montage, et inversement.
 */
export class ImportSupervisor {
  private readonly children = new Map<string, ChildProcess>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly workerId = `${process.env.HOSTNAME ?? "local"}:${process.pid}:imports`;

  constructor(private readonly opts: ImportSupervisorOptions) {}

  start(): void {
    if (this.timer) return;
    // Aucun sous-processus ne survit au process parent : tout import actif au démarrage est orphelin.
    const recovered = this.opts.db.recoverStaleMediaImports(0);
    if (recovered.length > 0) console.log(`[imports] Reprise au démarrage : ${recovered.length} import(s) remis en file`);
    this.timer = setInterval(() => this.tick(), this.opts.intervalMs ?? 5000);
    this.timer.unref?.();
    this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Déclenche un tick immédiat (après création d'un import, pas d'attente). */
  poke(): void {
    this.tick();
  }

  cancel(importId: string): void {
    this.opts.db.updateMediaImport(importId, { status: "cancelled" });
    const child = this.children.get(importId);
    if (child) {
      try {
        child.kill("SIGTERM");
      } catch {
        /* déjà mort */
      }
    }
  }

  private tick(): void {
    const { db } = this.opts;
    try {
      for (const id of this.children.keys()) db.touchMediaImport(id);
      db.recoverStaleMediaImports(this.opts.staleMs ?? 120000);
      const max = this.opts.maxConcurrent ?? parseInt(process.env.VIDEO_EDITOR_MAX_CONCURRENT_IMPORTS ?? "2", 10);
      while (this.children.size < max) {
        const imp = db.claimNextMediaImport(this.workerId);
        if (!imp) break;
        this.dispatch(imp.id);
      }
    } catch (err) {
      console.error(`[imports] tick error: ${(err as Error).message}`);
    }
  }

  private dispatch(importId: string): void {
    const child = spawn(process.execPath, [this.opts.workerCliPath, importId], {
      env: { ...process.env, VIDEO_EDITOR_STORAGE_ROOT: this.opts.storageRoot, VIDEO_EDITOR_DB_PATH: this.opts.dbPath },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.children.set(importId, child);
    console.log(`[imports] Import ${importId} lancé (pid ${child.pid})`);
    child.stdout?.on("data", (c) => process.stdout.write(`[import ${importId}] ${c}`));
    child.stderr?.on("data", (c) => process.stderr.write(`[import ${importId}] ${c}`));
    child.on("exit", (code) => {
      this.children.delete(importId);
      const fresh = this.opts.db.getMediaImport(importId);
      if (fresh && (fresh.status === "listing" || fresh.status === "importing")) {
        // Sorti sans se marquer : crash. Remis en file (reprise là où il
        // s'était arrêté), sauf crash en boucle.
        if (fresh.attempts >= 8) {
          this.opts.db.updateMediaImport(importId, { status: "failed", error: `Worker d'import sorti ${fresh.attempts} fois (code ${code}) — voir les logs serveur.` });
        } else {
          this.opts.db.requeueMediaImport(importId);
        }
        console.warn(`[imports] Worker ${importId} sorti (code ${code}) en cours de route`);
      }
      this.tick();
    });
  }
}

/**
 * Daemon scheduler autonome (§23 du brief factory — scale horizontal).
 *
 * Le MÊME scheduler que celui hébergé in-process par le serveur web, mais
 * lançable comme process/machine dédié. Grâce au claim atomique en base
 * (Db.claimNextRenderJob), on peut lancer autant de daemons que de
 * machines contre la même base : chacun réclame et exécute des jobs sans
 * jamais empiéter sur les autres — aucune réécriture de la logique métier
 * de montage. C'est la préparation "Machine 1 / Machine 2 / …" du brief.
 *
 * Usage :
 *   VIDEO_EDITOR_STORAGE_ROOT=/data \
 *   VIDEO_EDITOR_DB_PATH=/data/web.sqlite \
 *   node packages/orchestrator/dist/scheduler-daemon.js
 *
 * En mono-machine, on n'a PAS besoin de ce daemon : le serveur web
 * démarre déjà le scheduler in-process (voir apps/web/src/server/jobs.ts).
 * Ce fichier est le point d'entrée pour, plus tard, sortir le rendu du
 * process web et/ou l'étaler sur plusieurs machines.
 */
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { Db } from "@video-editor/db";
import { RenderScheduler } from "./scheduler.js";
import { loadFactoryConfig } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveWorkerCli(): string {
  // packages/orchestrator/dist → packages/pipeline/dist/cli-run-project.js
  return join(__dirname, "..", "..", "pipeline", "dist", "cli-run-project.js");
}

function main(): void {
  const storageRoot = process.env.VIDEO_EDITOR_STORAGE_ROOT;
  if (!storageRoot) throw new Error("VIDEO_EDITOR_STORAGE_ROOT requis");
  const dbPath = process.env.VIDEO_EDITOR_DB_PATH ?? join(storageRoot, "web.sqlite");
  const config = loadFactoryConfig();

  const db = new Db(dbPath);
  const scheduler = new RenderScheduler({
    db,
    workerCliPath: resolveWorkerCli(),
    storageRoot,
    dbPath,
    config,
    // En multi-machine, ne PAS requeue tous les running au démarrage
    // (ils appartiennent peut-être à une autre machine vivante) : la
    // reprise par heartbeat périmé s'en charge sans voler de job actif.
    recoverOnStart: process.env.VIDEO_EDITOR_RECOVER_ON_START === "1",
  });

  const decision = scheduler.getLastDecision();
  console.log(`[daemon] Scheduler autonome démarré — db=${dbPath}`);
  if (decision) console.log(`[daemon] ${decision.reason}`);
  scheduler.start();

  const shutdown = () => {
    console.log("[daemon] Arrêt…");
    scheduler.stop();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();

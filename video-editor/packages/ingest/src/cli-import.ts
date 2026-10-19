/**
 * Worker d'import spawné par l'ImportSupervisor (un process par import,
 * jamais dans le process web). Usage : node cli-import.js <importId>
 * Env : VIDEO_EDITOR_STORAGE_ROOT (obligatoire), VIDEO_EDITOR_DB_PATH,
 * R2_* (stockage), GOOGLE_DRIVE_API_KEY, VIDEO_EDITOR_IMPORT_CONCURRENCY.
 */
import { join } from "node:path";
import { Db } from "@video-editor/db";
import { createObjectStoreFromEnv } from "./object-store.js";
import { runImport } from "./import-runner.js";

async function main(): Promise<void> {
  const importId = process.argv[2];
  if (!importId) throw new Error("Usage: cli-import.js <importId>");
  const storageRoot = process.env.VIDEO_EDITOR_STORAGE_ROOT;
  if (!storageRoot) throw new Error("VIDEO_EDITOR_STORAGE_ROOT doit être défini par l'appelant.");
  const db = new Db(process.env.VIDEO_EDITOR_DB_PATH ?? join(storageRoot, "web.sqlite"));
  try {
    const status = await runImport({
      db,
      store: createObjectStoreFromEnv(storageRoot),
      importId,
      workDir: join(storageRoot, "ingest-tmp"),
    });
    console.log(`[import ${importId}] terminé : ${status}`);
  } catch (err) {
    db.updateMediaImport(importId, { status: "failed", error: (err as Error).message });
    throw err;
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error("cli-import a échoué:", err);
  process.exitCode = 1;
});

import { join } from "node:path";
import { createObjectStoreFromEnv, ImportSupervisor, type ObjectStore } from "@video-editor/ingest";
import type { MediaImport } from "@video-editor/shared-types";
import { resolveStorageRoot } from "./storage";
import { getDb, getDbPath } from "./db";

/**
 * Couture entre l'API HTTP et les imports cloud (@video-editor/ingest),
 * sur le modèle de jobs.ts : le process web ne télécharge rien lui-même,
 * il met l'import en file et s'assure que le superviseur tourne ; chaque
 * import s'exécute dans un sous-processus isolé.
 */
const INGEST_CLI = join(process.cwd(), "..", "..", "packages", "ingest", "dist", "cli-import.js");

declare global {
  var __videoEditorImportSupervisor: ImportSupervisor | undefined;
  var __videoEditorObjectStore: ObjectStore | undefined;
}

export function ensureImportSupervisor(): ImportSupervisor {
  if (!globalThis.__videoEditorImportSupervisor) {
    const sup = new ImportSupervisor({
      db: getDb(),
      workerCliPath: INGEST_CLI,
      storageRoot: resolveStorageRoot(),
      dbPath: getDbPath(),
    });
    sup.start();
    globalThis.__videoEditorImportSupervisor = sup;
  }
  return globalThis.__videoEditorImportSupervisor;
}

export function getObjectStore(): ObjectStore {
  if (!globalThis.__videoEditorObjectStore) {
    globalThis.__videoEditorObjectStore = createObjectStoreFromEnv(resolveStorageRoot());
  }
  return globalThis.__videoEditorObjectStore;
}

/** Import du user courant, ou réponse d'erreur prête à renvoyer. */
export function loadOwnedImport(id: string, userId: string | null): { imp: MediaImport } | { error: string; status: number } {
  if (!userId) return { error: "Authentification requise.", status: 401 };
  const imp = getDb().getMediaImport(id);
  if (!imp) return { error: "Import introuvable.", status: 404 };
  if (imp.userId !== userId) return { error: "Accès refusé à cet import.", status: 403 };
  return { imp };
}

import { Db } from "@video-editor/db";
import { join } from "node:path";
import { resolveStorageRoot } from "./storage";

declare global {
  var __videoEditorDb: Db | undefined;
}

/**
 * Singleton attaché à `globalThis` — indispensable en dev Next.js, dont
 * le hot-reload réimporte les modules à chaque changement de fichier ;
 * sans ça, chaque rechargement ouvrirait une nouvelle connexion SQLite
 * sur le même fichier (verrouillage de la base garanti). Même fichier
 * `web.sqlite` que les scripts CLI spawnés (packages/pipeline/src/cli-*)
 * — c'est le même stockage vu depuis deux entrées différentes.
 */
export function getDbPath(): string {
  return join(resolveStorageRoot(), "web.sqlite");
}

export function getDb(): Db {
  if (!globalThis.__videoEditorDb) {
    globalThis.__videoEditorDb = new Db(getDbPath());
  }
  return globalThis.__videoEditorDb;
}

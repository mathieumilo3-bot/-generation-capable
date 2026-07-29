import fs from "node:fs";
import path from "node:path";
import { bootstrapRuntime, type GcRuntime } from "@gc-ai-os/runtime";

declare global {
  // eslint-disable-next-line no-var
  var __gcRuntime: GcRuntime | undefined;
}

/**
 * Singleton process-local (voir docs/gc-ai-os/02-architecture-globale.md,
 * "Idempotence et reprise" — l'état vit en base, pas en mémoire de
 * process). Mis en cache sur `globalThis` pour survivre au rechargement
 * à chaud de Next.js en développement sans ouvrir une nouvelle connexion
 * SQLite à chaque requête.
 */
export function getRuntime(): GcRuntime {
  if (!globalThis.__gcRuntime) {
    const dataDir = path.join(process.cwd(), ".data");
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, "gc-ai-os.sqlite");
    globalThis.__gcRuntime = bootstrapRuntime(dbPath);
  }
  return globalThis.__gcRuntime;
}

import type { GcRuntime } from "@gc-ai-os/runtime";

declare global {
  // eslint-disable-next-line no-var
  var __gcRuntime: GcRuntime | undefined;
}

function loadNodeRuntime(): typeof import("@gc-ai-os/runtime") {
  return (0, eval)("require")("@gc-ai-os/runtime") as typeof import("@gc-ai-os/runtime");
}

function loadFs(): typeof import("node:fs") {
  return (0, eval)("require")("node:fs") as typeof import("node:fs");
}

function loadPath(): typeof import("node:path") {
  return (0, eval)("require")("node:path") as typeof import("node:path");
}

/**
 * Singleton process-local. Persistent state lives in the SQLite file on the
 * mounted runtime volume; the singleton only prevents duplicate connections
 * inside one Node process.
 */
export function getRuntime(): GcRuntime {
  if (!globalThis.__gcRuntime) {
    const fs = loadFs();
    const path = loadPath();
    const dataDir = path.join(process.cwd(), ".data");
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, "gc-ai-os.sqlite");
    globalThis.__gcRuntime = loadNodeRuntime().bootstrapRuntime(dbPath);
  }
  return globalThis.__gcRuntime;
}

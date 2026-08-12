import { spawn } from "node:child_process";
import { join } from "node:path";
import type { RunPipelineInput } from "@video-editor/pipeline";
import { resolveStorageRoot } from "./storage";

/**
 * Le pipeline tourne en sous-processus (voir
 * packages/pipeline/src/cli-run-project.ts) — jamais importé en direct
 * ici. Ce n'est pas seulement pour contourner le bundler webpack de
 * Next.js (@remotion/bundler ne s'y bundle pas proprement) : c'est aussi
 * l'architecture cible, un vrai worker séparé plutôt qu'un traitement
 * lourd dans le process qui sert les pages.
 */
const PIPELINE_CLI = join(process.cwd(), "..", "..", "packages", "pipeline", "dist", "cli-run-project.js");

const runningJobs = new Set<string>();

export function startPipelineJob(input: RunPipelineInput): void {
  if (runningJobs.has(input.projectId)) return;
  runningJobs.add(input.projectId);

  const child = spawn(process.execPath, [PIPELINE_CLI, JSON.stringify(input)], {
    env: { ...process.env, VIDEO_EDITOR_STORAGE_ROOT: resolveStorageRoot() },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[pipeline ${input.projectId}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[pipeline ${input.projectId}] ${chunk}`));
  child.on("exit", (code) => {
    runningJobs.delete(input.projectId);
    if (code !== 0) console.error(`[pipeline ${input.projectId}] sous-processus terminé avec le code ${code}`);
  });
}

export function isPipelineRunning(projectId: string): boolean {
  return runningJobs.has(projectId);
}

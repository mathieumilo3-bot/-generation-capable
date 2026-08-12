/**
 * Point d'entrée spawné en sous-processus par apps/web (voir
 * apps/web/src/server/jobs.ts) — jamais importé statiquement par le
 * serveur Next.js. Raison : @video-editor/render entraîne
 * @remotion/bundler (esbuild + binaires natifs rspack), que le bundler
 * webpack de Next ne sait pas exclure proprement d'une route API en
 * pratique (constaté empiriquement). Un vrai worker séparé — même
 * rudimentaire ici — est de toute façon l'architecture cible (§9 du
 * dossier stratégique : jobs asynchrones, pas de traitement lourd
 * dans le process web).
 *
 * Usage: node cli-run-project.js '<RunPipelineInput JSON>'
 */
import { Db } from "@video-editor/db";
import { ModelRouter } from "@video-editor/model-router";
import { runPipeline, type RunPipelineInput } from "./run-pipeline.js";

async function main(): Promise<void> {
  const raw = process.argv[2];
  if (!raw) throw new Error("Usage: cli-run-project.js '<RunPipelineInput JSON>'");
  const input = JSON.parse(raw) as RunPipelineInput;

  const storageRoot = process.env.VIDEO_EDITOR_STORAGE_ROOT;
  if (!storageRoot) throw new Error("VIDEO_EDITOR_STORAGE_ROOT doit être défini par l'appelant.");
  const dbPath = process.env.VIDEO_EDITOR_DB_PATH ?? `${storageRoot}/web.sqlite`;

  const db = new Db(dbPath);
  const router = new ModelRouter();
  try {
    await runPipeline(db, router, input, (stage, status) => {
      console.log(`[${input.projectId}] ${stage}: ${status}`);
    });
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error("cli-run-project a échoué:", err);
  process.exitCode = 1;
});

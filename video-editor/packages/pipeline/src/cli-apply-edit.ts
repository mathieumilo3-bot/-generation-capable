/**
 * Spawné par apps/web/src/app/api/projects/[id]/edit — même raison que
 * cli-run-project.ts : jamais d'import direct de @video-editor/render
 * dans le process Next.js.
 *
 * Usage: node cli-apply-edit.js <projectId> <command>
 * Écrit un JSON (ApplyCommandResult) sur stdout — c'est le seul canal
 * lu par l'appelant, pour rester robuste même si des logs parasites
 * apparaissent sur stderr.
 */
import { Db } from "@video-editor/db";
import { applyConversationalCommand } from "./apply-conversational-command.js";

async function main(): Promise<void> {
  const [projectId, command] = process.argv.slice(2);
  if (!projectId || !command) throw new Error("Usage: cli-apply-edit.js <projectId> <command>");

  const storageRoot = process.env.VIDEO_EDITOR_STORAGE_ROOT;
  if (!storageRoot) throw new Error("VIDEO_EDITOR_STORAGE_ROOT doit être défini par l'appelant.");
  const dbPath = process.env.VIDEO_EDITOR_DB_PATH ?? `${storageRoot}/web.sqlite`;

  const db = new Db(dbPath);
  try {
    const result = await applyConversationalCommand(db, projectId, command);
    process.stdout.write(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } finally {
    db.close();
  }
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ ok: false, error: String(err) }));
  process.exitCode = 1;
});

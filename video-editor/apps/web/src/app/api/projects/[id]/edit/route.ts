import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { getDb } from "@/server/db";
import { resolveStorageRoot } from "@/server/storage";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const EDIT_CLI = join(process.cwd(), "..", "..", "packages", "pipeline", "dist", "cli-apply-edit.js");

interface ApplyCommandResult {
  ok: boolean;
  videoUrl?: string;
  warnings?: string[];
  error?: string;
}

/**
 * Édition conversationnelle (§10, §15 du brief) : délègue au CLI
 * spawné plutôt que d'importer @video-editor/render ici — même raison
 * que la création de projet (server/jobs.ts).
 */
// Next.js 14 : params est un objet simple, pas une Promise (Next 15).
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const { id: projectId } = params;
  const body = (await request.json()) as { command?: string };
  if (!body.command) return NextResponse.json({ error: "Commande manquante." }, { status: 400 });

  const db = getDb();
  if (!db.getProject(projectId)) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  try {
    const { stdout } = await execFileAsync(process.execPath, [EDIT_CLI, projectId, body.command], {
      env: { ...process.env, VIDEO_EDITOR_STORAGE_ROOT: resolveStorageRoot() },
      maxBuffer: 1024 * 1024 * 16,
    });
    const result = JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as ApplyCommandResult;
    if (!result.ok) return NextResponse.json({ error: result.error ?? "Échec inconnu." }, { status: 501 });
    return NextResponse.json(result);
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout;
    if (stdout) {
      try {
        const result = JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as ApplyCommandResult;
        return NextResponse.json({ error: result.error ?? "Échec." }, { status: 501 });
      } catch {
        // tombe sur le message d'erreur générique ci-dessous
      }
    }
    return NextResponse.json({ error: `Commande échouée: ${(err as Error).message}` }, { status: 500 });
  }
}

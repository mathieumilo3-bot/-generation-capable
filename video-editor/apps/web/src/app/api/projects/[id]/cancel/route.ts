import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { cancelProjectJob } from "@/server/jobs";
import { getCurrentUserId } from "@/server/auth";

export const runtime = "nodejs";

/**
 * Annulation d'un montage en cours (§18 du brief factory). Le scheduler
 * tue le worker (SIGTERM puis SIGKILL), la base passe le job en
 * `cancelled` et le projet en `failed`. Les fichiers sources sont
 * conservés ; le nettoyage du dossier de travail est géré par le finally
 * du pipeline.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const { id } = params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const db = getDb();
  const project = db.getProject(id);
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  if (project.userId !== userId) return NextResponse.json({ error: "Accès refusé à ce projet." }, { status: 403 });

  const cancelled = cancelProjectJob(id);
  if (cancelled) db.setProjectStatus(id, "failed");
  return NextResponse.json({ cancelled });
}

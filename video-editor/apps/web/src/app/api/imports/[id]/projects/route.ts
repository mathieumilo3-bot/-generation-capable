import { NextResponse } from "next/server";
import { createProjectFromLibrary, selectForMontage } from "@video-editor/ingest";
import { getDb } from "@/server/db";
import { startPipelineJob } from "@/server/jobs";
import { loadOwnedImport } from "@/server/imports";
import { resolveStorageRoot } from "@/server/storage";
import { getCurrentUserId } from "@/server/auth";

export const runtime = "nodejs";

/**
 * Nouveau montage à partir des fichiers d'un import — autant de fois que
 * voulu, sans ré-importer. Crée un projet ordinaire puis le met dans la
 * file de rendu existante : même pipeline, même page de suivi.
 */
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const userId = await getCurrentUserId();
  const owned = loadOwnedImport(params.id, userId);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const body = (await request.json().catch(() => ({}))) as {
    brief?: string;
    preset?: string;
    assetIds?: string[];
    maxRushes?: number;
    maxTotalSec?: number;
  };
  const brief = body.brief?.trim();
  if (!brief) return NextResponse.json({ error: "Le brief est obligatoire — décris le montage voulu." }, { status: 400 });

  const db = getDb();
  const plans = selectForMontage(db.listMediaAssets(owned.imp.id), {
    assetIds: Array.isArray(body.assetIds) ? body.assetIds.filter((x) => typeof x === "string") : undefined,
    maxRushes: body.maxRushes ? Math.max(1, Math.min(60, body.maxRushes)) : undefined,
    maxTotalSec: body.maxTotalSec ? Math.max(10, Math.min(3600, body.maxTotalSec)) : undefined,
  });
  if (plans.length === 0) {
    return NextResponse.json({ error: "Aucune vidéo prête dans cette bibliothèque (import en cours ou uniquement des photos)." }, { status: 400 });
  }

  const project = createProjectFromLibrary(db, { userId: userId!, title: brief.slice(0, 80), plans, storageRoot: resolveStorageRoot() });
  startPipelineJob({ projectId: project.id, rawBriefText: brief, presetId: body.preset || undefined });
  return NextResponse.json({ projectId: project.id, rushes: plans.length });
}

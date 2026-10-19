import { NextResponse } from "next/server";
import { PROVIDER_LABEL_FR } from "@video-editor/ingest";
import { getDb } from "@/server/db";
import { ensureImportSupervisor, getObjectStore, loadOwnedImport } from "@/server/imports";
import { getCurrentUserId } from "@/server/auth";

export const runtime = "nodejs";

// Next.js 14 : params est un objet simple, pas une Promise (Next 15).
export async function GET(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const owned = loadOwnedImport(params.id, await getCurrentUserId());
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  ensureImportSupervisor();
  const db = getDb();
  const { imp } = owned;
  const assets = db.listMediaAssets(imp.id).map((a) => ({
    id: a.id,
    filename: a.originalFilename,
    kind: a.kind,
    status: a.status,
    sizeBytes: a.sizeBytes ?? null,
    width: a.width ?? null,
    height: a.height ?? null,
    durationSec: a.durationSec ?? null,
    videoCodec: a.videoCodec ?? null,
    container: a.container ?? null,
    takenAt: a.takenAt ?? null,
    attempts: a.attempts,
    error: a.error ?? null,
    hasThumb: Boolean(a.thumbKey),
    score: a.analysis?.score ?? null,
    tooDark: a.analysis?.tooDark ?? false,
    highlights: a.analysis?.highlights ?? [],
  }));
  const projects = db.listProjectsForMediaImport(imp.id).map((p) => ({ id: p.id, title: p.title, status: p.status, createdAt: p.createdAt }));
  return NextResponse.json({
    import: { ...imp, providerLabel: PROVIDER_LABEL_FR[imp.provider] },
    counts: db.countMediaAssets(imp.id),
    assets,
    projects,
    storage: getObjectStore().label,
  });
}

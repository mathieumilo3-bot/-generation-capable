import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { ensureImportSupervisor, loadOwnedImport } from "@/server/imports";
import { getCurrentUserId } from "@/server/auth";

export const runtime = "nodejs";

/** Relance manuelle : redonne leurs tentatives aux fichiers en échec définitif et relit le lien. */
export async function POST(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const owned = loadOwnedImport(params.id, await getCurrentUserId());
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  if (owned.imp.status === "listing" || owned.imp.status === "importing") {
    return NextResponse.json({ error: "Import déjà en cours." }, { status: 409 });
  }
  getDb().requeueMediaImport(owned.imp.id, { resetFailed: true });
  ensureImportSupervisor().poke();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { ensureImportSupervisor, loadOwnedImport } from "@/server/imports";
import { getCurrentUserId } from "@/server/auth";

export const runtime = "nodejs";

/** Test concluant → import complet (les fichiers du test ne sont pas retéléchargés). */
export async function POST(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const owned = loadOwnedImport(params.id, await getCurrentUserId());
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  if (owned.imp.status === "listing" || owned.imp.status === "importing") {
    return NextResponse.json({ error: "Import déjà en cours." }, { status: 409 });
  }
  getDb().requeueMediaImport(owned.imp.id, { mode: "full" });
  ensureImportSupervisor().poke();
  return NextResponse.json({ ok: true });
}

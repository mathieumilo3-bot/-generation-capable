import { NextResponse } from "next/server";
import { ensureImportSupervisor, loadOwnedImport } from "@/server/imports";
import { getCurrentUserId } from "@/server/auth";

export const runtime = "nodejs";

/** Arrête un import (les fichiers déjà dans le stockage restent utilisables). */
export async function POST(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const owned = loadOwnedImport(params.id, await getCurrentUserId());
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  ensureImportSupervisor().cancel(owned.imp.id);
  return NextResponse.json({ ok: true });
}

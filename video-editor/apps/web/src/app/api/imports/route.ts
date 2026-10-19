import { NextResponse } from "next/server";
import { parseShareUrl } from "@video-editor/ingest";
import { getDb } from "@/server/db";
import { ensureImportSupervisor, getObjectStore } from "@/server/imports";
import { getCurrentUserId, createUserSession } from "@/server/auth";

export const runtime = "nodejs";

/** Bibliothèque : imports du user avec leurs compteurs. */
export async function GET(): Promise<NextResponse> {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ imports: [], storage: getObjectStore().label });
  const db = getDb();
  ensureImportSupervisor();
  const imports = db.listMediaImportsByUser(userId).map((imp) => ({ ...imp, counts: db.countMediaAssets(imp.id) }));
  return NextResponse.json({ imports, storage: getObjectStore().label, storageBackend: getObjectStore().backend });
}

/**
 * Nouvel import depuis un lien de partage. Par défaut en MODE TEST
 * (quelques fichiers) : on vérifie que le lien est réellement exploitable
 * avant de lancer 1 000 téléchargements.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let userId = await getCurrentUserId();
  if (!userId) userId = await createUserSession();

  const body = (await request.json().catch(() => ({}))) as { url?: string; clientName?: string; mode?: string; sampleSize?: number };
  let link;
  try {
    link = parseShareUrl(body.url ?? "");
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  const clientName = (body.clientName ?? "").trim().slice(0, 80) || "Client";
  const mode = body.mode === "full" ? "full" : "probe";
  const sampleSize = Math.max(1, Math.min(20, Math.round(body.sampleSize ?? 3)));

  const imp = getDb().createMediaImport({ userId, clientName, sourceUrl: link.normalizedUrl, provider: link.provider, mode, sampleSize });
  ensureImportSupervisor().poke();
  return NextResponse.json({ importId: imp.id });
}

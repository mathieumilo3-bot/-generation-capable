import { NextResponse } from "next/server";
import { toWebStream } from "@video-editor/ingest";
import { getDb } from "@/server/db";
import { getObjectStore, loadOwnedImport } from "@/server/imports";
import { getCurrentUserId } from "@/server/auth";

export const runtime = "nodejs";

/**
 * Miniature ou original d'un fichier de bibliothèque. Avec R2 : redirection
 * vers une URL signée temporaire (les octets ne transitent pas par le
 * serveur). En repli local : flux direct.
 */
export async function GET(_request: Request, { params }: { params: { assetId: string; variant: string } }): Promise<Response> {
  const db = getDb();
  const asset = db.getMediaAsset(params.assetId);
  if (!asset) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  const owned = loadOwnedImport(asset.importId, await getCurrentUserId());
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const key = params.variant === "thumb" ? asset.thumbKey : params.variant === "original" ? asset.objectKey : undefined;
  if (!key) return NextResponse.json({ error: "Pas encore disponible." }, { status: 404 });

  const store = getObjectStore();
  const signed = await store.presignGet(key, 3600);
  if (signed) return NextResponse.redirect(signed, 302);
  const { stream, size } = await store.getStream(key);
  return new Response(toWebStream(stream), {
    headers: {
      "content-type": params.variant === "thumb" ? "image/jpeg" : asset.mimeType ?? "application/octet-stream",
      "content-length": String(size),
      "cache-control": "private, max-age=3600",
    },
  });
}

import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getDb } from "@/server/db";
import { getCurrentUserId } from "@/server/auth";

export const runtime = "nodejs";

// Next.js 14 : params est un objet simple, pas une Promise (Next 15).
export async function GET(_request: Request, { params }: { params: { id: string } }): Promise<Response> {
  const { id } = params;

  // Authentification requise
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  const db = getDb();
  const project = db.getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  // Vérification d'ownership
  if (project.userId !== userId) {
    return NextResponse.json({ error: "Accès refusé à ce projet." }, { status: 403 });
  }

  const renders = db.listRendersByProject(id);
  const finalRender = [...renders].reverse().find((r) => r.kind === "final" && r.status === "done" && r.filePath);
  if (!finalRender?.filePath) {
    return NextResponse.json({ error: "Aucun export final disponible pour ce projet." }, { status: 404 });
  }
  const stats = await stat(finalRender.filePath);
  const stream = Readable.toWeb(createReadStream(finalRender.filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "content-type": "video/mp4",
      "content-length": String(stats.size),
      "content-disposition": `inline; filename="${id}.mp4"`,
    },
  });
}

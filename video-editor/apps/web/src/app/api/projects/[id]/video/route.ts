import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getDb } from "@/server/db";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const db = getDb();
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

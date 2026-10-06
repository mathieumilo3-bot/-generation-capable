import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireGatewayAuth } from "@/server/engine-gateway/auth";
import { resultFile } from "@/server/engine-gateway/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  const denied = requireGatewayAuth(request);
  if (denied) return denied;
  const file = resultFile(params.id);
  if (!file) return NextResponse.json({ error: "not_ready" }, { status: 404 });
  const size = (await stat(file)).size;
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { "content-type": "video/mp4", "content-length": String(size) } });
}

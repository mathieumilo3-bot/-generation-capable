import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireGatewayAuth } from "@/server/engine-gateway/auth";
import { thumbnailFile } from "@/server/engine-gateway/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  const denied = requireGatewayAuth(request);
  if (denied) return denied;
  try {
    const f = await thumbnailFile(params.id);
    if (!f) return NextResponse.json({ error: "not_ready" }, { status: 404 });
    return new Response(await readFile(f), { headers: { "content-type": "image/jpeg" } });
  } catch { return NextResponse.json({ error: "thumbnail_failed" }, { status: 500 }); }
}

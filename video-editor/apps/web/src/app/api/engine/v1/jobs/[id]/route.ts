import { NextResponse } from "next/server";
import { requireGatewayAuth } from "@/server/engine-gateway/auth";
import { status } from "@/server/engine-gateway/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const denied = requireGatewayAuth(request);
  if (denied) return denied;
  const s = await status(params.id);
  return s ? NextResponse.json(s) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

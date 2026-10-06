import { NextResponse } from "next/server";
import { requireGatewayAuth } from "@/server/engine-gateway/auth";
import { GatewayError, purge, status } from "@/server/engine-gateway/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const denied = requireGatewayAuth(request);
  if (denied) return denied;
  const s = await status(params.id);
  return s ? NextResponse.json(s) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

/** Conservation minimale : supprime les fichiers du job (appelé par l'orchestrateur après livraison). Idempotent. */
export async function DELETE(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const denied = requireGatewayAuth(request);
  if (denied) return denied;
  try {
    return (await purge(params.id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (e) {
    if (e instanceof GatewayError) return NextResponse.json({ error: e.code }, { status: e.status });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

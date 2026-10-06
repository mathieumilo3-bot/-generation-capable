import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Passerelle moteur ⇄ orchestrateur (serveur-à-serveur UNIQUEMENT). Jeton partagé comparé à temps
 * constant. Sans ENGINE_GATEWAY_TOKEN configuré, la passerelle est FERMÉE (jamais ouverte par défaut).
 * L'application mobile ne connaît ni cette URL ni ce jeton.
 */
export function requireGatewayAuth(request: Request): NextResponse | null {
  const expected = process.env.ENGINE_GATEWAY_TOKEN;
  if (!expected || expected.length < 16) {
    return NextResponse.json({ error: "gateway_not_configured" }, { status: 503 });
  }
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

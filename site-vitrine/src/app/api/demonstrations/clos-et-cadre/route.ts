import { NextResponse } from "next/server";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { parseRequest, qualify } from "@/lib/demos/clos-et-cadre/request";

/**
 * Demonstration endpoint for the Clos & Cadre project request.
 *
 * It does exactly what a production endpoint would do before hand-off —
 * validate the payload server-side, then qualify it into a project brief —
 * and stops there: nothing is stored, logged or emailed. Clos & Cadre is a
 * fictional company, so no personal data may leave this request.
 */

const MAX_BODY_BYTES = 16_000;

export async function POST(request: Request) {
  const limit = rateLimit(`demo-cc:${clientIpFrom(request)}`, 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Honeypot filled: answer like a success so the bot learns nothing.
  if (typeof body === "object" && body !== null && typeof (body as { website?: unknown }).website === "string" && (body as { website: string }).website.trim() !== "") {
    return NextResponse.json({ ok: true, brief: null }, { status: 202 });
  }

  const parsed = parseRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_request", errors: parsed.errors }, { status: 400 });
  }

  return NextResponse.json({ ok: true, brief: qualify(parsed.request) });
}

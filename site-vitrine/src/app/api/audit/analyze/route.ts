import { NextResponse } from "next/server";
import { runAudit } from "@/lib/audit-engine/engine";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/**
 * Runs the Capable Audit analysis engine and returns a Report.
 *
 * Deliberately separate from POST /api/audit: that endpoint captures a lead
 * and sends email — this one only computes an analysis and sends nothing.
 * Keeping them apart means a slow or failing probe here can never delay or
 * break lead capture, and this endpoint needs no PII at all (no name, no
 * email) since it runs before or independently of the coordonnées step.
 */

const MAX_BODY_BYTES = 2 * 1024; // siteUrl + secteur + objectif, generously.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const FIELD_LIMITS = { siteUrl: 300, secteur: 120, objectif: 120 };
// The engine can spend up to ~5s probing the site, then up to 30s on the
// structured OpenAI synthesis. Keep the outer guard above both stages while
// staying below Netlify's 60s synchronous execution limit.
const ANALYZE_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("analyze_timeout")), ms)),
  ]);
}

function readString(raw: Record<string, unknown>, key: string, max: number): string {
  const value = raw[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const limit = rateLimit(`audit-analyze:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const source = payload as Record<string, unknown>;
  const siteUrl = readString(source, "siteUrl", FIELD_LIMITS.siteUrl);
  const secteur = readString(source, "secteur", FIELD_LIMITS.secteur);
  const objectif = readString(source, "objectif", FIELD_LIMITS.objectif);

  if (!siteUrl) {
    return NextResponse.json({ error: "missing_fields", missing: ["siteUrl"] }, { status: 422 });
  }

  try {
    const report = await withTimeout(runAudit({ siteUrl, secteur, objectif }), ANALYZE_TIMEOUT_MS);
    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    // The engine itself never throws for a probe failure (it degrades the
    // report instead) — reaching here means our own outer timeout fired, or
    // a genuine bug. Either way: fail soft. The funnel's fallback success
    // message covers this, so a lead is never lost over a broken diagnostic.
    console.error("[audit/analyze] engine failed:", error);
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }
}

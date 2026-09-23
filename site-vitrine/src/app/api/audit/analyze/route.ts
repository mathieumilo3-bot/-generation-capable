import { NextResponse } from "next/server";
import { diagnoseDossier, verifyDossier } from "@/lib/audit-engine/diagnostic";
import { reportFromDiagnostic, runAudit } from "@/lib/audit-engine/engine";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/**
 * Stage 2 of the diagnostic: turns the signed dossier produced by
 * /api/audit/research into the three validated cards and returns a Report.
 *
 * Without a dossier (research stage failed, older client), it runs the
 * one-shot pipeline instead — shorter research, same validation.
 *
 * Deliberately separate from POST /api/audit: this endpoint captures no
 * lead and sends no email.
 */

const MAX_BODY_BYTES = 160 * 1024; // a signed dossier: ~14 pages of bounded excerpts + research notes.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const FIELD_LIMITS = { entreprise: 160, siteUrl: 300, secteur: 120, objectif: 240, ville: 120 };
// Below Netlify's 60 s synchronous execution limit.
const ANALYZE_TIMEOUT_MS = 58_000;
const SYNTHESIS_TIMEOUT_MS = 52_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("analyze_timeout")), ms)),
  ]);
}

function readString(raw: Record<string, unknown>, key: keyof typeof FIELD_LIMITS): string {
  const value = raw[key];
  return typeof value === "string" ? value.trim().slice(0, FIELD_LIMITS[key]) : "";
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
  const objectif = readString(source, "objectif");

  if ("dossier" in source) {
    if (!verifyDossier(source.dossier, source.signature)) {
      return NextResponse.json({ error: "invalid_dossier" }, { status: 400 });
    }
    const dossier = source.dossier;
    try {
      const diagnostic = await withTimeout(diagnoseDossier(dossier, { timeoutMs: SYNTHESIS_TIMEOUT_MS }), ANALYZE_TIMEOUT_MS);
      return NextResponse.json({ report: reportFromDiagnostic(dossier, diagnostic, objectif) }, { status: 200 });
    } catch (error) {
      console.error("[audit/analyze] diagnosis failed:", error);
      return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
    }
  }

  const entreprise = readString(source, "entreprise");
  const siteUrl = readString(source, "siteUrl");
  const secteur = readString(source, "secteur");
  const ville = readString(source, "ville");

  if (!entreprise && !siteUrl) {
    return NextResponse.json({ error: "missing_fields", missing: ["entreprise"] }, { status: 422 });
  }

  try {
    const report = await withTimeout(runAudit({ entreprise, siteUrl, secteur, objectif, ville }), ANALYZE_TIMEOUT_MS);
    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    // Reaching here means our own outer timeout fired, or a genuine bug.
    console.error("[audit/analyze] engine failed:", error);
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }
}

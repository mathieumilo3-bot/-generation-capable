import { NextResponse } from "next/server";
import {
  collectInvestigation,
  siteOnlyDiagnostic,
  verifyContext,
  verifyJob,
  type AuditContext,
} from "@/lib/audit-engine/diagnostic";
import { reportFromContext, runAudit } from "@/lib/audit-engine/engine";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/**
 * Stage 2 of the diagnostic: read the background investigation once and,
 * when it lands, validate every card before returning the report.
 *
 * Three shapes, all short:
 *  - context + job  → poll; "pending" until the investigation finishes.
 *  - context alone  → the site-verified diagnostic (what ships when the
 *                     investigation could not be started or gave nothing).
 *  - company fields → a bounded crawl + site-verified diagnostic, for a
 *                     client that never reached stage 1.
 *
 * Deliberately separate from POST /api/audit: this endpoint captures no
 * lead and sends no email.
 */

const MAX_BODY_BYTES = 150 * 1024; // a signed context: bounded evidence + anchors.
const WINDOW_MS = 10 * 60 * 1000;
const START_MAX = 10;
const POLL_MAX = 300;
const FIELD_LIMITS = { entreprise: 160, siteUrl: 300, secteur: 120, objectif: 240, ville: 120 };
// Well inside the host's synchronous limit: one poll, or one bounded crawl.
const REQUEST_TIMEOUT_MS = 8_500;

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

  // --- context-driven: poll the investigation, or ship what the site proved ---
  if ("context" in source) {
    const limit = rateLimit(`audit-analyze-poll:${ip}`, POLL_MAX, WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
    if (!verifyContext(source.context, source.signature)) {
      return NextResponse.json({ error: "invalid_context" }, { status: 400 });
    }
    const context: AuditContext = source.context;

    if (source.jobId === undefined) {
      return NextResponse.json({ status: "done", report: reportFromContext(context, siteOnlyDiagnostic(context), objectif) }, { status: 200 });
    }
    if (!verifyJob("investigation", source.jobId, source.token)) {
      return NextResponse.json({ error: "invalid_job" }, { status: 400 });
    }

    try {
      const outcome = await withTimeout(collectInvestigation(source.jobId, context), REQUEST_TIMEOUT_MS);
      if (outcome.status === "pending") return NextResponse.json({ status: "pending" }, { status: 200 });
      if (outcome.status === "failed") {
        // The investigation is gone for good: ship the site-verified cards
        // rather than leaving the visitor with nothing.
        return NextResponse.json(
          { status: "done", degradedTo: "site", report: reportFromContext(context, siteOnlyDiagnostic(context), objectif) },
          { status: 200 }
        );
      }
      return NextResponse.json({ status: "done", report: reportFromContext(context, outcome.diagnostic, objectif) }, { status: 200 });
    } catch (error) {
      console.error("[audit/analyze] poll failed:", error);
      return NextResponse.json({ status: "pending" }, { status: 200 });
    }
  }

  // --- no context: crawl and diagnose from the site alone, bounded ---
  const limit = rateLimit(`audit-analyze:${ip}`, START_MAX, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const entreprise = readString(source, "entreprise");
  const siteUrl = readString(source, "siteUrl");
  const secteur = readString(source, "secteur");
  const ville = readString(source, "ville");

  if (!entreprise && !siteUrl) {
    return NextResponse.json({ error: "missing_fields", missing: ["entreprise"] }, { status: 422 });
  }

  try {
    const report = await withTimeout(runAudit({ entreprise, siteUrl, secteur, objectif, ville }), REQUEST_TIMEOUT_MS);
    return NextResponse.json({ status: "done", report }, { status: 200 });
  } catch (error) {
    // Reaching here means our own outer timeout fired, or a genuine bug.
    console.error("[audit/analyze] engine failed:", error);
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }
}

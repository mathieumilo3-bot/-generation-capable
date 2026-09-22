import { NextResponse } from "next/server";
import { classifySector } from "@/lib/audit-engine/classify";
import { probeSite } from "@/lib/audit-engine/probe";
import { runAllAnalyzers } from "@/lib/audit-engine/analyzers";
import { buildReport } from "@/lib/audit-engine/report";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import type { DeclaredInput } from "@/lib/audit-engine/types";

const MAX_BODY_BYTES = 1024;
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const QUICK_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("quick_audit_timeout")), ms)
    ),
  ]);
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const limit = rateLimit(`audit-quick:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

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

  const rawUrl = (payload as Record<string, unknown>).siteUrl;
  const siteUrl = typeof rawUrl === "string" ? rawUrl.trim().slice(0, 300) : "";

  if (!siteUrl) {
    return NextResponse.json({ error: "missing_site" }, { status: 422 });
  }

  const input: DeclaredInput = {
    siteUrl,
    secteur: "",
    objectif: "Plus de demandes de devis",
  };

  try {
    const report = await withTimeout(
      (async () => {
        const site = await probeSite(input.siteUrl);
        const sector = classifySector(input.secteur);
        const findings = runAllAnalyzers(input, site, sector);
        return buildReport(input, site, sector, findings);
      })(),
      QUICK_TIMEOUT_MS
    );

    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    console.error("[audit/quick] quick scan failed:", error);
    return NextResponse.json({ error: "quick_scan_failed" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { collectCompanyDiscovery, discoverCompany, startCompanyDiscovery } from "@/lib/audit-engine/company-discovery";
import { lookupFrenchRegistry, registryIdentityHint } from "@/lib/audit-engine/company-registry";
import { signJob, verifyJob } from "@/lib/audit-engine/diagnostic";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/**
 * Company identification, in two short requests.
 *
 * Searching the web for a company takes far longer than the host allows a
 * request to run, so the search itself runs as a background job on the
 * model side: this endpoint either starts one (and returns its signed id)
 * or reads it once. Neither branch waits.
 */

const MAX_BODY_BYTES = 1024;
const WINDOW_MS = 10 * 60 * 1000;
const START_MAX = 3;
// Polling is a single cheap read, so it gets a much wider budget — a
// diagnostic legitimately polls every couple of seconds for a minute.
const POLL_MAX = 200;
const STAGE = "discovery";
// Last resort, kept short enough to answer inside the host's request limit.
const SYNC_FALLBACK_TIMEOUT_MS = 6_000;

function readString(raw: Record<string, unknown>, key: string, max: number): string {
  const value = raw[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request);

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });

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
  const companyName = readString(source, "companyName", 160);
  const cityHint = readString(source, "cityHint", 120);
  const rescue = source.rescue === true;

  // --- poll an existing job ---
  if (source.jobId !== undefined) {
    const poll = rateLimit(`audit-discover-poll:${ip}`, POLL_MAX, WINDOW_MS);
    if (!poll.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(poll.retryAfterSeconds) } });
    }
    if (!verifyJob(STAGE, source.jobId, source.token)) {
      return NextResponse.json({ error: "invalid_job" }, { status: 400 });
    }
    if (companyName.length < 2) return NextResponse.json({ error: "missing_company_name" }, { status: 422 });

    try {
      const outcome = await collectCompanyDiscovery(source.jobId, companyName, { cityHint });
      if (outcome.status === "pending") return NextResponse.json({ status: "pending" }, { status: 200 });
      if (outcome.status === "failed") return NextResponse.json({ status: "failed", reason: outcome.reason }, { status: 200 });
      return NextResponse.json({ status: "done", candidates: outcome.result.candidates }, { status: 200 });
    } catch (error) {
      console.error("[audit/discover] poll failed:", error);
      return NextResponse.json({ status: "failed", reason: "poll_error" }, { status: 200 });
    }
  }

  // --- start a job ---
  const start = rateLimit(`audit-discover:${ip}`, START_MAX, WINDOW_MS);
  if (!start.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(start.retryAfterSeconds) } });
  }
  if (companyName.length < 2) return NextResponse.json({ error: "missing_company_name" }, { status: 422 });

  try {
    // Fast deterministic preflight against the official French company
    // registry. It is only an accelerator: if unavailable or inconclusive,
    // the existing web discovery below remains the fallback.
    const registry = await lookupFrenchRegistry(companyName, cityHint);

    // Exact homonyms in different cities: do not spend 10–20 seconds
    // researching websites we cannot safely choose between. Ask the visitor
    // for the city immediately.
    if (!cityHint && registry.status === "ambiguous") {
      return NextResponse.json(
        {
          status: "needs_city",
          candidates: registry.candidates.map((candidate) => ({
            name: candidate.name,
            website: "",
            sector: "",
            city: candidate.city,
            summary: `Entreprise française enregistrée sous le SIREN ${candidate.siren}.`,
            confidence: "medium",
          })),
        },
        { status: 200 }
      );
    }

    const registryCandidate = registry.status === "unique" ? registry.candidates[0] : null;
    const effectiveCity = cityHint || registryCandidate?.city || "";
    const identityHint = registryCandidate ? registryIdentityHint(registryCandidate) : "";

    const jobId = await startCompanyDiscovery(companyName, {
      cityHint: effectiveCity,
      identityHint,
      rescue,
    });
    if (jobId) {
      return NextResponse.json(
        {
          status: "started",
          jobId,
          token: signJob(STAGE, jobId),
          ...(effectiveCity ? { resolvedCity: effectiveCity } : {}),
        },
        { status: 200 }
      );
    }

    // Background mode unavailable: one bounded attempt in this request
    // rather than sending the visitor on with nothing but the typed name.
    const direct = await discoverCompany(companyName, {
      cityHint: effectiveCity,
      identityHint,
      firstTimeoutMs: SYNC_FALLBACK_TIMEOUT_MS,
      skipRescue: !rescue,
    });
    return NextResponse.json({ status: "done", candidates: direct.candidates }, { status: 200 });
  } catch (error) {
    console.error("[audit/discover] start failed:", error);
    return NextResponse.json({ status: "unavailable" }, { status: 200 });
  }
}

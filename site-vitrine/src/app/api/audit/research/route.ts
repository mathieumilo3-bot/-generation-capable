import { NextResponse } from "next/server";
import { buildDossier, signContext, signJob, startInvestigation, toAuditContext } from "@/lib/audit-engine/diagnostic";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/**
 * Stage 1 of the diagnostic: read the official site page by page, turn it
 * into verified facts and site-verified cards, then hand the whole dossier
 * to a background job that will search the web and write the diagnostic.
 *
 * Bounded so the whole request stays comfortably inside the host's
 * synchronous limit: the crawl gets 5 s, starting the job at most 3.5 s.
 * Captures no lead and sends no email.
 */

const MAX_BODY_BYTES = 2 * 1024;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const CRAWL_BUDGET_MS = 5_000;
const JOB_START_TIMEOUT_MS = 3_500;
const FIELD_LIMITS = { entreprise: 160, siteUrl: 300, secteur: 120, ville: 120 };

function readString(raw: Record<string, unknown>, key: keyof typeof FIELD_LIMITS): string {
  const value = raw[key];
  return typeof value === "string" ? value.trim().slice(0, FIELD_LIMITS[key]) : "";
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const limit = rateLimit(`audit-research:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

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
  const input = {
    entreprise: readString(source, "entreprise"),
    siteUrl: readString(source, "siteUrl"),
    secteur: readString(source, "secteur"),
    ville: readString(source, "ville"),
  };
  if (!input.entreprise && !input.siteUrl) {
    return NextResponse.json({ error: "missing_fields", missing: ["entreprise"] }, { status: 422 });
  }

  try {
    const dossier = await buildDossier(input, { budgetMs: CRAWL_BUDGET_MS });
    const context = toAuditContext(dossier);
    const jobId = await startInvestigation(dossier, { timeoutMs: JOB_START_TIMEOUT_MS });

    return NextResponse.json(
      {
        context,
        signature: signContext(context),
        ...(jobId ? { jobId, token: signJob("investigation", jobId) } : {}),
        stats: {
          pagesAnalyzed: context.stats.pagesAnalyzed,
          siteReachable: context.stats.siteReachable,
          evidenceCards: context.evidenceCards.length,
          investigating: Boolean(jobId),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[audit/research] failed:", error);
    return NextResponse.json({ error: "research_failed" }, { status: 502 });
  }
}

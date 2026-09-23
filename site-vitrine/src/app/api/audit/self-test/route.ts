import { NextResponse } from "next/server";
import { buildDossier, collectInvestigation, startInvestigation, toAuditContext } from "@/lib/audit-engine/diagnostic";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/**
 * Proves the diagnostic pipeline works on the deployed host, and says how
 * long each stage really took there.
 *
 * It exists because the stages are bounded by the host's request limit and
 * by OpenAI's background mode, neither of which can be measured from a
 * developer machine. Every call reports per-stage timings, so a stage that
 * would be cut short is visible before a visitor ever meets it.
 *
 * It is not an open crawler: only the companies listed below can be run,
 * and it never captures a lead or sends an email.
 */

const CASES: Record<string, { entreprise: string; siteUrl: string; secteur: string; ville: string }> = {
  gc: { entreprise: "GC Agence", siteUrl: "https://gc-agence.com", secteur: "Agence web", ville: "" },
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_RUNS = 6;
const STEP_BUDGET_MS = 8_500;

function elapsed(from: number): number {
  return Date.now() - from;
}

export async function GET(request: Request) {
  const ip = clientIpFrom(request);
  const limit = rateLimit(`audit-self-test:${ip}`, MAX_RUNS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const url = new URL(request.url);
  const testCase = CASES[url.searchParams.get("case") ?? "gc"];
  if (!testCase) return NextResponse.json({ error: "unknown_case", cases: Object.keys(CASES) }, { status: 422 });

  const jobId = url.searchParams.get("job");
  const started = Date.now();

  // Second call onwards: read the job started by the first one.
  if (jobId) {
    const dossierAt = Date.now();
    const dossier = await buildDossier(testCase, { budgetMs: 5_000 });
    const context = toAuditContext(dossier);
    const outcome = await collectInvestigation(jobId, context);
    return NextResponse.json(
      {
        stage: "poll",
        status: outcome.status,
        crawlMs: elapsed(dossierAt),
        totalMs: elapsed(started),
        ...(outcome.status === "done"
          ? {
              mode: outcome.diagnostic.mode,
              queriesRun: outcome.diagnostic.queriesRun,
              sourcesConsulted: outcome.diagnostic.sourcesConsulted,
              summary: outcome.diagnostic.summary,
              cards: outcome.diagnostic.cards,
            }
          : {}),
        ...(outcome.status === "failed" ? { reason: outcome.reason } : {}),
      },
      { status: 200 }
    );
  }

  const crawlAt = Date.now();
  const dossier = await buildDossier(testCase, { budgetMs: 5_000 });
  const crawlMs = elapsed(crawlAt);
  const context = toAuditContext(dossier);

  const startAt = Date.now();
  const newJobId = await startInvestigation(dossier, { timeoutMs: 3_500 });
  const startMs = elapsed(startAt);

  return NextResponse.json(
    {
      stage: "start",
      totalMs: elapsed(started),
      crawlMs,
      jobStartMs: startMs,
      // Under the host's limit is the whole point: say it plainly.
      withinRequestBudget: elapsed(started) < STEP_BUDGET_MS,
      site: {
        reachable: dossier.site.reachable,
        pagesAnalyzed: dossier.site.pages.length,
        paths: dossier.site.pages.map((page) => page.path),
        sitemapUrlCount: dossier.site.sitemapUrlCount,
      },
      evidenceCards: dossier.evidenceCards.map((card) => ({ id: card.id, title: card.title, score: card.score })),
      backgroundMode: Boolean(newJobId),
      job: newJobId,
      next: newJobId ? `${url.pathname}?case=${url.searchParams.get("case") ?? "gc"}&job=${newJobId}` : null,
    },
    { status: 200 }
  );
}

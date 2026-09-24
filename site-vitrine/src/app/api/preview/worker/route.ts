import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { advancePreview } from "@/lib/preview-engine/pipeline";
import { pipelineDeps, requireStore } from "@/lib/preview-engine/service";
import { previewMode } from "@/lib/preview-engine/version";

/**
 * Background continuation, called every minute by the scheduled function
 * (netlify/functions/audit-ready-cron.mjs). Advances previews whose visitor
 * left the page, and delivers "ready" e-mails that were requested late.
 * Server-to-server only: bearer secret required.
 */

const TOTAL_BUDGET_MS = 8_000;

function authorized(request: Request): boolean {
  const secret = process.env.PREVIEW_WORKER_SECRET || process.env.GC_AUDIT_RPC_SECRET || "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (previewMode() === "off") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });

  const started = Date.now();
  const deps = pipelineDeps(store);
  const rows = await store.listActive(10);
  const report: { id: string; stage: string; status: string }[] = [];

  for (const row of rows) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < 1_500) break;
    try {
      if (row.status === "ready") {
        if (row.email && !row.notified_at && (await store.markNotified(row.id))) await deps.sendReadyEmail(row);
        report.push({ id: row.id, stage: row.stage, status: "notified" });
        continue;
      }
      const result = await advancePreview(row.id, deps, Math.min(4_000, remaining - 1_000));
      report.push({ id: row.id, stage: result?.row.stage ?? row.stage, status: result?.row.status ?? row.status });
    } catch (error) {
      console.error("[preview/worker] row failed", row.id, error);
    }
  }
  return NextResponse.json({ processed: report.length, rows: report }, { status: 200 });
}

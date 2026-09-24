import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { fixturesEnabled } from "@/lib/preview-engine/fixtures";
import { advancePreview, initialPipeline, publicStatus } from "@/lib/preview-engine/pipeline";
import { attributionFrom, pipelineDeps, readJson, requireStore, text, trustedOrigin } from "@/lib/preview-engine/service";
import { previewToken, tokenHash } from "@/lib/preview-engine/tokens";
import { previewMode, PREVIEW_ENGINE_VERSION } from "@/lib/preview-engine/version";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/**
 * Starts a preview. One short request:
 *  1. registry pre-check (≤ 1.8 s) — exact homonyms in several cities ⇒ ask
 *     the city right away, before any paid search;
 *  2. create the preview (idempotent on the client's key: a double click or
 *     a retry returns the same preview, never a second paid pipeline);
 *  3. advance it for a few seconds (starts the identification job).
 */

const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  if (previewMode() === "off") return NextResponse.json({ error: "not_found" }, { status: 404 });
  // A preview can become paid only when GC_PREVIEW_AI_ENABLED=true. Keep a
  // tight per-IP limit plus a process-level global breaker for accident bursts.
  const limit = rateLimit(`preview-start:${clientIpFrom(request)}`, fixturesEnabled() ? 500 : 3, WINDOW_MS);
  const globalLimit = rateLimit("preview-start:global", fixturesEnabled() ? 5_000 : 20, WINDOW_MS);
  const blocked = !limit.allowed ? limit : !globalLimit.allowed ? globalLimit : null;
  if (blocked) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(blocked.retryAfterSeconds) } });
  }

  const body = await readJson(request, 4 * 1024);
  if (!body) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const companyName = text(body, "companyName", 160);
  const cityHint = text(body, "cityHint", 120);
  const idempotencyKey = text(body, "idempotencyKey", 64);
  if (companyName.length < 2) return NextResponse.json({ error: "missing_company_name" }, { status: 422 });
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(idempotencyKey)) return NextResponse.json({ error: "invalid_idempotency_key" }, { status: 422 });

  const store = requireStore();
  if (!store) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  const deps = pipelineDeps(store);

  try {
    const registry = await deps.lookupRegistry(companyName, cityHint);
    if (registry.status === "ambiguous" && !cityHint) {
      return NextResponse.json({ status: "needs_city", candidateCount: registry.candidates.length }, { status: 200 });
    }

    const id = randomUUID();
    const created = await store.create({
      id,
      idempotencyKey,
      tokenHash: tokenHash(previewToken(id)),
      companyName,
      input: { companyName, ...(cityHint ? { cityHint } : {}), ...(trustedOrigin(request) ? { origin: trustedOrigin(request) } : {}) },
      attribution: attributionFrom(body),
      pipeline: initialPipeline(),
      work: { registry: registry.status === "unique" ? registry.candidates[0] : null, ...(cityHint ? { userCity: cityHint } : {}) },
      stage: "identity",
      engineVersion: PREVIEW_ENGINE_VERSION,
    });
    if (!created) return NextResponse.json({ error: "storage_failed" }, { status: 503 });
    const token = previewToken(created.id);

    const advanced = await advancePreview(created.id, deps, 3_500);
    const row = advanced?.row ?? created;
    return NextResponse.json({ status: "started", id: created.id, token, preview: publicStatus(row) }, { status: 200 });
  } catch (error) {
    console.error("[preview/start] failed:", error);
    return NextResponse.json({ error: "start_failed" }, { status: 502 });
  }
}

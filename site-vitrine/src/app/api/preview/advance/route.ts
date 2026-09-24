import { NextResponse } from "next/server";
import { advancePreview, publicStatus } from "@/lib/preview-engine/pipeline";
import { pipelineDeps, readJson, requireStore } from "@/lib/preview-engine/service";
import { verifyPreviewToken } from "@/lib/preview-engine/tokens";
import { previewMode } from "@/lib/preview-engine/version";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/**
 * Moves a preview forward for at most a few seconds and reports where it
 * stands. Called by the waiting screen every couple of seconds; the
 * background worker calls the same pipeline once the visitor has left.
 */
export async function POST(request: Request) {
  if (previewMode() === "off") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const limit = rateLimit(`preview-advance:${clientIpFrom(request)}`, 400, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  const body = await readJson(request, 1024);
  if (!body || !verifyPreviewToken(body.id, body.token)) return NextResponse.json({ error: "invalid_preview" }, { status: 400 });
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });

  try {
    const result = await advancePreview(body.id, pipelineDeps(store));
    if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ preview: publicStatus(result.row) }, { status: 200 });
  } catch (error) {
    console.error("[preview/advance] failed:", error);
    const row = await store.get(body.id);
    return row ? NextResponse.json({ preview: publicStatus(row) }, { status: 200 }) : NextResponse.json({ error: "advance_failed" }, { status: 502 });
  }
}

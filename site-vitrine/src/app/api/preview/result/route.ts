import { NextResponse } from "next/server";
import { publicStatus } from "@/lib/preview-engine/pipeline";
import { toPreviewDocument } from "@/lib/preview-engine/public-view";
import { readJson, requireStore } from "@/lib/preview-engine/service";
import { verifyPreviewToken } from "@/lib/preview-engine/tokens";
import { previewMode } from "@/lib/preview-engine/version";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/** Returns the renderable document of a ready preview. Id + signed token required: nothing is listable. */
export async function POST(request: Request) {
  if (previewMode() === "off") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const limit = rateLimit(`preview-result:${clientIpFrom(request)}`, 120, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await readJson(request, 1024);
  if (!body || !verifyPreviewToken(body.id, body.token)) return NextResponse.json({ error: "invalid_preview" }, { status: 400 });
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  const row = await store.get(body.id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return NextResponse.json({ error: "expired" }, { status: 410 });
  if (row.status !== "ready" || !row.company_profile || !row.preview_blueprint) {
    return NextResponse.json({ status: "pending", preview: publicStatus(row) }, { status: 200 });
  }
  return NextResponse.json(
    { status: "ready", preview: publicStatus(row), document: toPreviewDocument(row.id, row.company_profile, row.preview_blueprint) },
    { status: 200 }
  );
}

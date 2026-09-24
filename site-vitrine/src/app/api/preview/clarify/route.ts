import { NextResponse } from "next/server";
import { resolveTargetUrl } from "@/lib/audit-engine/probe";
import { advancePreview, clarifyPreview, publicStatus } from "@/lib/preview-engine/pipeline";
import { pipelineDeps, readJson, requireStore, text } from "@/lib/preview-engine/service";
import { verifyPreviewToken } from "@/lib/preview-engine/tokens";
import { previewMode } from "@/lib/preview-engine/version";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/** The single precision the pipeline may ask for: the city, or the site address (or "no site"). */
export async function POST(request: Request) {
  if (previewMode() === "off") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const limit = rateLimit(`preview-clarify:${clientIpFrom(request)}`, 20, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await readJson(request, 2 * 1024);
  if (!body || !verifyPreviewToken(body.id, body.token)) return NextResponse.json({ error: "invalid_preview" }, { status: 400 });
  const city = text(body, "city", 120);
  const rawSite = text(body, "siteUrl", 300);
  const noSite = body.noSite === true;
  let siteUrl = "";
  if (rawSite) {
    const resolved = resolveTargetUrl(rawSite);
    if (!resolved.ok) return NextResponse.json({ error: "invalid_site" }, { status: 422 });
    siteUrl = `${resolved.url.protocol}//${resolved.url.host}/`;
  }
  if (!city && !siteUrl && !noSite) return NextResponse.json({ error: "missing_answer" }, { status: 422 });

  const store = requireStore();
  if (!store) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  const deps = pipelineDeps(store);
  const row = await clarifyPreview(body.id, { city: city || undefined, siteUrl: siteUrl || undefined, noSite }, deps);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const advanced = await advancePreview(body.id, deps, 3_500);
  return NextResponse.json({ preview: publicStatus(advanced?.row ?? row) }, { status: 200 });
}

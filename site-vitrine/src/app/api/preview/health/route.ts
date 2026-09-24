import { NextResponse } from "next/server";
import { openAiKey } from "@/lib/audit-engine/openai";
import { previewStore } from "@/lib/preview-engine/store";
import { PREVIEW_BLUEPRINT_VERSION, PREVIEW_DATA_VERSION, PREVIEW_ENGINE_VERSION, previewMode } from "@/lib/preview-engine/version";

/** Which engine is deployed, and whether its dependencies are configured. No secret, no data. */
export async function GET() {
  if (previewMode() === "off") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    mode: previewMode(),
    engine: PREVIEW_ENGINE_VERSION,
    data: PREVIEW_DATA_VERSION,
    blueprint: PREVIEW_BLUEPRINT_VERSION,
    commit: (process.env.COMMIT_REF || process.env.GC_BUILD_COMMIT || "").slice(0, 40),
    store: previewStore()?.kind ?? null,
    ai: Boolean(openAiKey()),
    email: Boolean(process.env.RESEND_API_KEY),
  });
}

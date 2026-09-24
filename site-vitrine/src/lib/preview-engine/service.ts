import { SITE_URL } from "@/lib/constants";
import { sendPreviewReadyEmail } from "./email";
import { fixtureDeps, fixturesEnabled } from "./fixtures";
import { defaultDeps, type PipelineDeps } from "./pipeline";
import { checkRenderable } from "./render-check";
import { previewStore, type PreviewStore } from "./store";

/** Wires the pipeline to the real world (or to the offline fixtures in dev/test). */
export function pipelineDeps(store: PreviewStore): PipelineDeps {
  return defaultDeps(store, {
    renderCheck: checkRenderable,
    sendReadyEmail: (row) => sendPreviewReadyEmail(row, SITE_URL),
    ...(fixturesEnabled() ? fixtureDeps() : {}),
  });
}

export function requireStore(): PreviewStore | null {
  return previewStore();
}

const ALLOWED_ORIGIN = /^https:\/\/(?:www\.)?gc-agence\.com$|^https:\/\/[a-z0-9-]+--gc-agence\.netlify\.app$|^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}$/;

/** The origin a preview link should point back to — only our own hosts. */
export function trustedOrigin(request: Request): string | undefined {
  const origin = request.headers.get("origin") ?? "";
  return ALLOWED_ORIGIN.test(origin) ? origin : undefined;
}

export async function readJson(request: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (raw.length > maxBytes) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function text(source: Record<string, unknown>, key: string, max: number): string {
  const value = source[key];
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
}

const ATTRIBUTION_KEYS = ["source", "medium", "campaign", "content", "term", "gclid", "gbraid", "wbraid"] as const;

/** Attribution is kept only when the visitor accepted measurement (same rule as the audit funnel). */
export function attributionFrom(source: Record<string, unknown>): Record<string, string> {
  const raw = source.attribution;
  if (source.consent !== "GRANTED" || !raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = text(raw as Record<string, unknown>, key, key.endsWith("id") || key.endsWith("braid") ? 220 : 120);
    if (value) out[key] = value;
  }
  return out;
}

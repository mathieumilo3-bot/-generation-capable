import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Read tokens and signed asset URLs.
 *
 * A preview's read token is an HMAC of its id: nothing secret is stored, the
 * server can rebuild the link for the ready e-mail, and only the server can
 * issue one. The database keeps a hash of it as a second lock.
 */

function secret(): string {
  // Deliberately reads the raw env vars, not `openAiKey()`: that helper is
  // gated by the AI spend circuit breaker (AUDIT_AI_ENABLED), and token
  // signing must never go weaker just because AI spend was turned off.
  return (
    process.env.PREVIEW_SIGNING_SECRET ||
    process.env.AUDIT_SIGNING_SECRET ||
    process.env.OPENAI_API_KEY ||
    process.env.OPEN_API_KEY ||
    "gc-preview-local-dev-only"
  );
}

function hmac(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function previewToken(id: string): string {
  return hmac(`gc-preview:v1:${id}`);
}

export function verifyPreviewToken(id: unknown, token: unknown): id is string {
  return isUuid(id) && typeof token === "string" && token.length === 43 && safeEqual(previewToken(id), token);
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function signAssetUrl(url: string): string {
  return hmac(`gc-preview-asset:v1:${url}`).slice(0, 32);
}

/** Only URLs the server put in a preview can be fetched through the proxy. */
export function proxiedAssetPath(url: string): string {
  return `/api/preview/image?u=${Buffer.from(url).toString("base64url")}&s=${signAssetUrl(url)}`;
}

export function readProxiedAsset(u: unknown, s: unknown): string | null {
  if (typeof u !== "string" || typeof s !== "string" || u.length > 2_000 || s.length !== 32) return null;
  let url: string;
  try {
    url = Buffer.from(u, "base64url").toString("utf8");
  } catch {
    return null;
  }
  return safeEqual(signAssetUrl(url), s) ? url : null;
}

export function fingerprintOf(parts: { siren?: string | null; domain?: string | null; name?: string; city?: string }, dataVersion: string): string | null {
  const key = parts.siren
    ? `siren:${parts.siren}`
    : parts.domain
      ? `domain:${parts.domain.toLowerCase().replace(/^www\./, "")}`
      : parts.name && parts.city
        ? `name:${parts.name.toLowerCase().trim()}|${parts.city.toLowerCase().trim()}`
        : null;
  return key ? createHash("sha256").update(`${key}|${dataVersion}`).digest("hex") : null;
}

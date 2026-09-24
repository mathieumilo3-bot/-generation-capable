import { fetchPublicAsset } from "@/lib/audit-engine/probe";
import { fixturePng, fixturesEnabled } from "@/lib/preview-engine/fixtures";
import { readProxiedAsset } from "@/lib/preview-engine/tokens";
import { previewMode } from "@/lib/preview-engine/version";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/**
 * Signed image proxy. Only URLs the server itself placed in a preview can be
 * fetched (HMAC), through the same SSRF guards as the crawler, image types
 * only, 5 MB max. The visitor's browser never contacts the company's host,
 * mixed-content http images still display, and an SVG logo is served with a
 * sandboxing policy so it can never run script.
 */

const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml"]);
const MAX_BYTES = 5 * 1024 * 1024;

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export async function GET(request: Request) {
  if (previewMode() === "off") return new Response("Not found", { status: 404 });
  const limit = rateLimit(`preview-image:${clientIpFrom(request)}`, 600, 10 * 60 * 1000);
  if (!limit.allowed) return new Response("Too many requests", { status: 429 });

  const params = new URL(request.url).searchParams;
  const url = readProxiedAsset(params.get("u"), params.get("s"));
  if (!url) return new Response("Forbidden", { status: 403 });

  if (fixturesEnabled() && url.includes(".test/")) {
    return new Response(Buffer.from(fixturePng(url)), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600", ...SECURITY_HEADERS },
    });
  }

  const result = await fetchPublicAsset(url, { timeoutMs: 6_000, maxBytes: MAX_BYTES, accept: (type) => TYPES.has(type) });
  if (!result.ok) {
    return new Response("Unavailable", { status: 404, headers: { "Cache-Control": "public, max-age=600", ...SECURITY_HEADERS } });
  }
  return new Response(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Length": String(result.bytes.byteLength),
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      ...SECURITY_HEADERS,
    },
  });
}

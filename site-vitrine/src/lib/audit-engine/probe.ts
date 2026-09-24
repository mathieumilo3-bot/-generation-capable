import { lookup as dnsLookup } from "node:dns/promises";
import { observed, unknown, type SiteSignals, type SocialNetwork } from "./types";

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 1_500_000; // 1.5 MB — a marketing homepage fits well inside this.
const MAX_REDIRECTS = 5;
const USER_AGENT =
  "Mozilla/5.0 (compatible; CapableAuditBot/1.0; +https://gc-agence.com/audit)";

/**
 * Blocks the probe from being turned into an SSRF pivot once this runs on a
 * real server: no non-HTTP(S) scheme, no loopback/private/link-local
 * address, no bare IP literal pretending to be a public host name.
 *
 * This catches the address as typed. Hostnames are resolved separately before
 * the first request and before every redirect.
 */
function isBlockedTarget(hostname: string): boolean {
  // IPv6 literals keep their brackets in URL#hostname (e.g. "[::1]").
  const host = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 0) return true;
    return false;
  }

  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true; // IPv6 loopback / link-local / unique-local
  }

  return false;
}

export type ResolvedTarget =
  | { ok: true; url: URL }
  | { ok: false; reason: "invalid_url" | "blocked_target" };

export type DnsLookupFn = (hostname: string) => Promise<{ address: string }[]>;

/** The real resolver, wrapped so tests can inject a fake one without touching the network. */
export async function defaultDnsLookup(hostname: string): Promise<{ address: string }[]> {
  return dnsLookup(hostname, { all: true });
}

/**
 * Closes the gap `resolveTargetUrl` cannot: a hostname can look perfectly
 * public (has a dot, isn't a literal private IP) and still resolve, at
 * request time, to a loopback or private address — DNS rebinding, or simply
 * an internal hostname on a private zone. This resolves it once, ahead of
 * the fetch, and blocks it the same way a literal private IP would be.
 *
 * A lookup failure is not a block: a genuinely dead domain should fail with
 * `network_error` from the fetch itself, not be silently reported as
 * `blocked_target`.
 */
export async function resolvesToBlockedIp(hostname: string, lookupFn: DnsLookupFn = defaultDnsLookup): Promise<boolean> {
  try {
    const records = await lookupFn(hostname);
    return records.some((record) => isBlockedTarget(record.address));
  } catch {
    return false;
  }
}

/**
 * Validates every redirect before following it. `fetch(..., { redirect:
 * "follow" })` would validate only the visitor-supplied host and could then be
 * redirected to a loopback, private-network or cloud-metadata address.
 */
export async function resolveSafeRedirect(
  location: string,
  from: URL,
  lookupFn: DnsLookupFn = defaultDnsLookup
): Promise<ResolvedTarget> {
  let next: URL;
  try {
    next = new URL(location, from);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  const resolved = resolveTargetUrl(next.toString());
  if (!resolved.ok) return resolved;
  if (await resolvesToBlockedIp(resolved.url.hostname, lookupFn)) {
    return { ok: false, reason: "blocked_target" };
  }
  return resolved;
}

/**
 * Turns whatever the visitor typed in "Votre site" into a fetchable URL.
 * The field's own placeholder invites a bare domain ("votresite.fr") or a
 * social handle URL, so this is deliberately forgiving about a missing
 * scheme — but never about scheme or target.
 */
export function resolveTargetUrl(raw: string): ResolvedTarget {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "invalid_url" };

  const candidates = /^https?:\/\//i.test(trimmed) ? [trimmed] : [`https://${trimmed}`, `http://${trimmed}`];

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      // Check for a blocked target before the "looks like a domain" shape
      // check below — an IPv6 literal or bare private IP has no dot and
      // must not fall through to "invalid_url" instead of being blocked.
      if (isBlockedTarget(url.hostname)) return { ok: false, reason: "blocked_target" };
      if (!url.hostname.includes(".")) continue; // no TLD — not a fetchable public site
      return { ok: true, url };
    } catch {
      continue;
    }
  }

  return { ok: false, reason: "invalid_url" };
}

// --- Pure HTML parsing -------------------------------------------------
//
// Deliberately regex-based rather than a DOM/HTML parser dependency: the
// signals below only need "is this substring present", not a full tree, and
// a hand-rolled tag soup parser would be more code and more bugs for the
// same result. Every regex here is anchored to a real, observable marker —
// see each signal's comment for exactly what it looks for.

function stripTagsToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAll(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((m) => m[1]?.trim() ?? "").filter(Boolean);
}

const SOCIAL_PATTERNS: Record<SocialNetwork, RegExp> = {
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-z0-9._-]+/i,
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[a-z0-9.\-_]+/i,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[a-z0-9._-]+/i,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-z0-9._-]+/i,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)?[a-z0-9._-]+/i,
  twitter: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-z0-9._-]+/i,
};

const ACTION_WORDS = [
  "réserver",
  "réservation",
  "rendez-vous",
  "prendre rendez-vous",
  "devis",
  "commander",
  "acheter",
  "ajouter au panier",
  "contactez-nous",
  "appelez",
  "essai gratuit",
  "démo",
  "inscription",
  "s'inscrire",
];

const TESTIMONIAL_MARKERS = [/avis/i, /témoignage/i, /ils nous font confiance/i, /clients disent/i, /★/, /⭐/];
const FAQ_MARKERS = [/questions? fréquentes?/i, /faq/i, /<details/i];
const GUARANTEE_MARKERS = [/satisfait ou remboursé/i, /garantie/i, /remboursement/i, /sans engagement/i];
const URGENCY_MARKERS = [/places? limitées?/i, /offre limitée/i, /derniers? jours?/i, /jusqu'au/i, /stock limité/i];
const LEGAL_MARKERS = [/mentions légales/i, /politique de confidentialité/i, /cgv/i, /conditions générales/i];

/** Parses a raw HTML document into the site's observable signals. Pure — no network, no I/O. */
export function parseHtmlSignals(html: string): Omit<SiteSignals, "reachable" | "finalUrl" | "httpStatus" | "responseTimeMs" | "isHttps"> {
  const text = stripTagsToText(html);
  const lowerHtml = html.toLowerCase();

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const h1s = matchAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map((h) => stripTagsToText(h)).filter(Boolean);

  const socialLinks: Partial<Record<SocialNetwork, string>> = {};
  for (const [network, pattern] of Object.entries(SOCIAL_PATTERNS) as [SocialNetwork, RegExp][]) {
    const match = html.match(pattern);
    if (match) socialLinks[network] = match[0];
  }

  const foundActionWords = ACTION_WORDS.filter((word) => text.toLowerCase().includes(word));
  const textExcerpt = text.slice(0, 8_000);

  return {
    title: titleMatch ? observed(stripTagsToText(titleMatch[1]).slice(0, 200), "balise <title>") : unknown("balise <title> absente"),
    metaDescription: descMatch
      ? observed(descMatch[1].slice(0, 300), "balise <meta name=\"description\">")
      : unknown("balise meta description absente"),
    h1: h1s.length > 0 ? observed(h1s.slice(0, 5), "balises <h1>") : unknown("aucune balise <h1> trouvée"),
    wordCount: observed(text.split(/\s+/).filter(Boolean).length, "contenu texte de la page"),
    hasViewportMeta: observed(/<meta[^>]+name=["']viewport["']/i.test(html), "balise <meta name=\"viewport\">"),
    hasHtmlLangAttr: observed(/<html[^>]+lang=["'][a-z-]+["']/i.test(html), "attribut lang sur <html>"),
    hasStructuredData: observed(
      /<script[^>]+type=["']application\/ld\+json["']/i.test(html),
      "balise <script type=\"application/ld+json\">"
    ),
    telLinkCount: observed((html.match(/href=["']tel:/gi) ?? []).length, "liens href=\"tel:\""),
    mailtoLinkCount: observed((html.match(/href=["']mailto:/gi) ?? []).length, "liens href=\"mailto:\""),
    formCount: observed((html.match(/<form[\s>]/gi) ?? []).length, "balises <form>"),
    socialLinks:
      Object.keys(socialLinks).length > 0
        ? observed(socialLinks, "liens sortants vers des réseaux sociaux")
        : unknown("aucun lien de réseau social détecté sur la page"),
    actionWords:
      foundActionWords.length > 0
        ? observed(foundActionWords, "vocabulaire d'action présent dans le texte de la page")
        : unknown("aucun vocabulaire d'action détecté"),
    priceMentionCount: observed((text.match(/\d+([.,]\d+)?\s?€|€\s?\d+/g) ?? []).length, "mentions de prix (€) dans le texte"),
    testimonialSignalCount: observed(
      TESTIMONIAL_MARKERS.filter((pattern) => pattern.test(text) || pattern.test(lowerHtml)).length,
      "marqueurs de témoignages/avis dans la page"
    ),
    faqSignalPresent: observed(FAQ_MARKERS.some((p) => p.test(lowerHtml)), "marqueurs de FAQ dans la page"),
    guaranteeSignalPresent: observed(GUARANTEE_MARKERS.some((p) => p.test(text)), "marqueurs de garantie dans le texte"),
    urgencySignalPresent: observed(URGENCY_MARKERS.some((p) => p.test(text)), "marqueurs d'urgence/rareté dans le texte"),
    legalNoticeLinkPresent: observed(LEGAL_MARKERS.some((p) => p.test(lowerHtml)), "lien ou mention légale détecté"),
    textExcerpt: textExcerpt
      ? observed(textExcerpt, "extrait borné du texte public de la page")
      : unknown("aucun texte public exploitable"),
  };
}

export function unreachableSignals(reason: SiteSignals["unreachableReason"]): SiteSignals {
  const why = `site non analysable (${reason})`;
  return {
    reachable: false,
    unreachableReason: reason,
    title: unknown(why),
    metaDescription: unknown(why),
    h1: unknown(why),
    wordCount: unknown(why),
    hasViewportMeta: unknown(why),
    hasHtmlLangAttr: unknown(why),
    hasStructuredData: unknown(why),
    telLinkCount: unknown(why),
    mailtoLinkCount: unknown(why),
    formCount: unknown(why),
    socialLinks: unknown(why),
    actionWords: unknown(why),
    priceMentionCount: unknown(why),
    testimonialSignalCount: unknown(why),
    faqSignalPresent: unknown(why),
    guaranteeSignalPresent: unknown(why),
    urgencySignalPresent: unknown(why),
    legalNoticeLinkPresent: unknown(why),
  };
}

export type FetchHtmlResult =
  | { ok: true; finalUrl: URL; status: number; html: string; responseTimeMs: number }
  | { ok: false; reason: NonNullable<SiteSignals["unreachableReason"]>; status?: number; responseTimeMs?: number };

export type FetchHtmlOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  /** Accept non-HTML text bodies (sitemap.xml). */
  acceptXml?: boolean;
};

/**
 * Fetches one public page with every SSRF guard applied (scheme, literal
 * private IP, DNS resolution before the first request and before each
 * redirect), bounded on time and size. Never throws.
 */
export async function fetchPublicHtml(rawUrl: string, options: FetchHtmlOptions = {}): Promise<FetchHtmlResult> {
  const resolved = resolveTargetUrl(rawUrl);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  if (await resolvesToBlockedIp(resolved.url.hostname)) return { ok: false, reason: "blocked_target" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? FETCH_TIMEOUT_MS);
  const startedAt = Date.now();
  const maxBytes = options.maxBytes ?? MAX_BODY_BYTES;

  try {
    let currentUrl = resolved.url;
    let response: Response | null = null;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: options.acceptXml ? "application/xml,text/xml,text/html;q=0.9,*/*;q=0.8" : "text/html,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9",
        },
      });

      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) return { ok: false, reason: "network_error" };

      const next = await resolveSafeRedirect(location, currentUrl);
      if (!next.ok) return { ok: false, reason: next.reason };
      currentUrl = next.url;
    }

    if (!response) return { ok: false, reason: "network_error" };
    const responseTimeMs = Date.now() - startedAt;
    if (!response.ok) return { ok: false, reason: "http_error", status: response.status, responseTimeMs };

    const contentType = response.headers.get("content-type") ?? "";
    const acceptable =
      !contentType ||
      contentType.includes("text/html") ||
      contentType.includes("application/xhtml") ||
      (options.acceptXml && contentType.includes("xml"));
    if (!acceptable) return { ok: false, reason: "empty_body", status: response.status, responseTimeMs };

    // Read with a hard cap rather than response.text(): a malicious or
    // misconfigured target could otherwise stream an unbounded body.
    const reader = response.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
      await reader.cancel().catch(() => {});
    } else {
      html = await response.text();
    }

    if (!html.trim()) return { ok: false, reason: "empty_body", status: response.status, responseTimeMs };
    return { ok: true, finalUrl: currentUrl, status: response.status, html, responseTimeMs };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Turns an already-fetched homepage into the site's signal set. */
export function signalsFromFetch(result: FetchHtmlResult): SiteSignals {
  if (!result.ok) {
    return {
      ...unreachableSignals(result.reason),
      ...(result.status ? { httpStatus: result.status } : {}),
      ...(result.responseTimeMs !== undefined ? { responseTimeMs: result.responseTimeMs } : {}),
    };
  }
  return {
    reachable: true,
    finalUrl: result.finalUrl.toString(),
    httpStatus: result.status,
    responseTimeMs: result.responseTimeMs,
    isHttps: result.finalUrl.protocol === "https:",
    ...parseHtmlSignals(result.html),
  };
}

/**
 * Fetches and reads the target site's homepage and returns its parsed
 * signals — or, on any failure, a fully UNKNOWN signal set with the reason
 * attached. Never throws.
 */
export async function probeSite(rawUrl: string): Promise<SiteSignals> {
  return signalsFromFetch(await fetchPublicHtml(rawUrl));
}

export type FetchAssetResult =
  | { ok: true; finalUrl: URL; contentType: string; bytes: Uint8Array }
  | { ok: false; reason: NonNullable<SiteSignals["unreachableReason"]> | "unsupported_type" | "too_large"; status?: number };

/**
 * Fetches one public binary asset (an image published on a company site)
 * with exactly the same SSRF guards as `fetchPublicHtml`: scheme, literal
 * private IP, DNS resolution before the first request and before each
 * redirect. Bounded on time and size; the content type must be accepted by
 * the caller. A body larger than `maxBytes` is refused rather than truncated.
 * Never throws.
 */
export async function fetchPublicAsset(
  rawUrl: string,
  options: { timeoutMs?: number; maxBytes: number; accept: (contentType: string) => boolean }
): Promise<FetchAssetResult> {
  const resolved = resolveTargetUrl(rawUrl);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  if (await resolvesToBlockedIp(resolved.url.hostname)) return { ok: false, reason: "blocked_target" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? FETCH_TIMEOUT_MS);

  try {
    let currentUrl = resolved.url;
    let response: Response | null = null;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "image/avif,image/webp,image/*;q=0.9,*/*;q=0.5" },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) return { ok: false, reason: "network_error" };
      const next = await resolveSafeRedirect(location, currentUrl);
      if (!next.ok) return { ok: false, reason: next.reason };
      currentUrl = next.url;
    }

    if (!response) return { ok: false, reason: "network_error" };
    if (!response.ok) return { ok: false, reason: "http_error", status: response.status };

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!options.accept(contentType)) {
      await response.body?.cancel().catch(() => {});
      return { ok: false, reason: "unsupported_type", status: response.status };
    }
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > options.maxBytes) {
      await response.body?.cancel().catch(() => {});
      return { ok: false, reason: "too_large", status: response.status };
    }

    const reader = response.body?.getReader();
    if (!reader) return { ok: false, reason: "empty_body", status: response.status };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > options.maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "too_large", status: response.status };
      }
      chunks.push(value);
    }
    if (total === 0) return { ok: false, reason: "empty_body", status: response.status };
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, finalUrl: currentUrl, contentType, bytes };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

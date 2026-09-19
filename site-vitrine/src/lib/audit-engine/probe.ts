import { observed, unknown, type SiteSignals, type SocialNetwork } from "./types";

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 1_500_000; // 1.5 MB — a marketing homepage fits well inside this.
const USER_AGENT =
  "Mozilla/5.0 (compatible; CapableAuditBot/1.0; +https://generationcapable.fr/audit)";

/**
 * Blocks the probe from being turned into an SSRF pivot once this runs on a
 * real server: no non-HTTP(S) scheme, no loopback/private/link-local
 * address, no bare IP literal pretending to be a public host name.
 *
 * This only catches the address as typed — it does not resolve DNS, so a
 * hostname that itself resolves to a private range at request time is
 * still stopped downstream by the fetch's own network failure, just later
 * and less precisely (reported as `network_error`, not `blocked_target`).
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
  };
}

function unreachableSignals(reason: SiteSignals["unreachableReason"]): SiteSignals {
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

/**
 * Fetches and reads the target site, bounded on time and size, and returns
 * its parsed signals — or, on any failure, a fully UNKNOWN signal set with
 * the reason attached. Never throws: a probe failure degrades the report,
 * it never breaks the request that asked for one.
 */
export async function probeSite(rawUrl: string): Promise<SiteSignals> {
  const resolved = resolveTargetUrl(rawUrl);
  if (!resolved.ok) return unreachableSignals(resolved.reason);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(resolved.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" },
    });
    const responseTimeMs = Date.now() - startedAt;

    if (!response.ok) {
      return { ...unreachableSignals("http_error"), httpStatus: response.status, responseTimeMs };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { ...unreachableSignals("empty_body"), httpStatus: response.status, responseTimeMs };
    }

    // Read with a hard cap rather than response.text(): a malicious or
    // misconfigured target could otherwise stream an unbounded body.
    const reader = response.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < MAX_BODY_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
      await reader.cancel().catch(() => {});
    } else {
      html = await response.text();
    }

    if (!html.trim()) {
      return { ...unreachableSignals("empty_body"), httpStatus: response.status, responseTimeMs };
    }

    const finalUrlObj = new URL(response.url || resolved.url.toString());
    return {
      reachable: true,
      finalUrl: finalUrlObj.toString(),
      httpStatus: response.status,
      responseTimeMs,
      isHttps: finalUrlObj.protocol === "https:",
      ...parseHtmlSignals(html),
    };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    return unreachableSignals(reason);
  } finally {
    clearTimeout(timer);
  }
}

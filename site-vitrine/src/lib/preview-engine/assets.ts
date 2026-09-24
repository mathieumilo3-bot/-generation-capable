import { htmlToText, type PageKind } from "@/lib/audit-engine/crawl";

/**
 * Reads, from HTML the crawler ALREADY downloaded, what a redesign needs to
 * keep: published photos, the logo, the colours in use, public emails and
 * any review score the site itself displays. Pure — no network. The HTML is
 * untrusted data: it is only pattern-matched, never rendered or executed.
 */

export type CrawledHtml = { url: string; kind: PageKind; html: string };

export type RawImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  pageUrl: string;
  pagePath: string;
  pageKind: PageKind;
  /** Where on the page: header area, main content, or a CSS background / og:image. */
  placement: "header" | "content" | "background" | "og";
};

export type SiteReviewMention = { rating?: string; count?: string; platform: string; pagePath: string; quote: string };

export type SiteParagraph = { pagePath: string; pageKind: PageKind; text: string };

export type ExtractedAssets = {
  images: RawImage[];
  /** Body paragraphs (never header, nav or footer): the clean sentences a redesign can quote. */
  paragraphs: SiteParagraph[];
  logo: RawImage | null;
  themeColor?: string;
  inlineCss: string[];
  stylesheetUrls: string[];
  siteName?: string;
  emails: string[];
  reviewMentions: SiteReviewMention[];
};

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").replace(/&amp;/g, "&").trim();
}

function toNumber(value: string): number | undefined {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 && n < 20_000 ? n : undefined;
}

function resolveUrl(raw: string, base: URL): URL | null {
  if (!raw || /^(?:data:|blob:|javascript:)/i.test(raw)) return null;
  try {
    const url = new URL(raw, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

/** Picks the srcset candidate closest to ~1200 px wide without going far above. */
export function pickFromSrcset(srcset: string): { url: string; width?: number } | null {
  const candidates = srcset
    .split(/,\s+(?=\S)/)
    .map((entry) => {
      const [url, descriptor = ""] = entry.trim().split(/\s+/);
      const w = descriptor.endsWith("w") ? Number.parseInt(descriptor, 10) : undefined;
      return { url, width: Number.isFinite(w) ? w : undefined };
    })
    .filter((c) => c.url);
  if (candidates.length === 0) return null;
  const sized = candidates.filter((c) => c.width);
  if (sized.length === 0) return candidates[candidates.length - 1];
  const fitting = sized.filter((c) => c.width! <= 1800).sort((a, b) => b.width! - a.width!);
  return fitting[0] ?? sized.sort((a, b) => a.width! - b.width!)[0];
}

const NON_PHOTO_NAME =
  /(?:^|[\/_.-])(?:logo|logos|icon|icons|ico|favicon|sprite|avatar|pixel|spacer|blank|loader|loading|spinner|arrow|fleche|flag|badge|picto|pictogramme|placeholder|cookie|payment|paiement|visa|mastercard|paypal|qualibat|rge|qualipac|qualifelec|label|labels|certif|certification|facebook|instagram|linkedin|google|youtube|whatsapp|tiktok|twitter|tripadvisor|emoji|gravatar|map|carte|signature|captcha|recaptcha|trustpilot|widget|star|etoile|check|close|menu|burger|search|play)(?:[\/_.-]|\d|$)/i;
const PHOTO_EXT = /\.(?:jpe?g|png|webp|avif)(?:$|\?)/i;
const LOGO_EXT = /\.(?:svg|png|webp|jpe?g|avif)(?:$|\?)/i;
const WP_SIZE = /-(\d{2,4})x(\d{2,4})(?=\.[a-z]+(?:$|\?))/i;

/** Two URLs of the same photo at different sizes collapse to one key. */
export function imageKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(WP_SIZE, "").toLowerCase()}`;
  } catch {
    return url;
  }
}

function headerRanges(html: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const m of html.matchAll(/<header\b[\s\S]*?<\/header>/gi)) ranges.push([m.index!, m.index! + m[0].length]);
  if (ranges.length === 0) {
    const nav = html.search(/<nav\b/i);
    if (nav >= 0) ranges.push([Math.max(0, nav - 3_000), nav + 6_000]);
  }
  return ranges;
}

function inRanges(index: number, ranges: [number, number][]): boolean {
  return ranges.some(([a, b]) => index >= a && index <= b);
}

function pathOf(url: URL): string {
  return url.pathname || "/";
}

const RATING_RE = /\b([1-5][,.]\d)\s*(?:\/\s*5|sur\s*5|★)/i;
const COUNT_RE = /\b(\d{1,5})\s+avis\b/i;
const PLATFORM_RE = /google|pagesjaunes|facebook|trustpilot|houzz|travaux\.com|habitatpresto|avis v[ée]rifi[ée]s/i;

function reviewMentionsIn(text: string, pagePath: string): SiteReviewMention[] {
  const mentions: SiteReviewMention[] = [];
  for (const m of text.matchAll(new RegExp(RATING_RE.source, "gi"))) {
    const index = m.index ?? 0;
    const window = text.slice(Math.max(0, index - 120), index + 160);
    const platform = window.match(PLATFORM_RE)?.[0];
    if (!platform) continue;
    const count = window.match(COUNT_RE)?.[1];
    mentions.push({
      rating: `${m[1].replace(".", ",")}/5`,
      ...(count ? { count: `${count} avis` } : {}),
      platform: /google/i.test(platform) ? "Google" : platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase(),
      pagePath,
      quote: window.trim().slice(0, 220),
    });
    if (mentions.length >= 2) break;
  }
  return mentions;
}

/**
 * A sentence fit to be quoted on a page: real prose, not a menu, a phone
 * line or a list of links glued together by the text extraction.
 */
export function isCleanSentence(text: string, min = 20, max = 260): boolean {
  if (text.length < min || text.length > max) return false;
  if (/[|•»«<>{}/]|https?:\/\/|www\.|@|©/.test(text)) return false;
  // A real sentence ends like one (a menu or a cut excerpt does not).
  if (!/[.!?…]["»”)]?$/.test(text)) return false;
  // Mostly capitalised words = a list of links or labels, not prose.
  const words = text.split(/\s+/).slice(1);
  const capitalised = words.filter((w) => /^[A-ZÀ-ÖØ-Ý]/.test(w)).length;
  if (words.length >= 5 && capitalised / words.length > 0.34) return false;
  if (/(?:(?:\+|00)33[\s.-]?|\b0)[1-9](?:[\s.-]?\d{2}){4}/.test(text)) return false;
  if (!/^[«"“(]?[A-ZÀ-ÖØ-Ý0-9]/.test(text)) return false;
  // Four capitalised words in a row is a navigation bar, not a sentence.
  if (/(?:\b[A-ZÀ-ÖØ-Ý][\p{L}'’-]+\s+){4}/u.test(text)) return false;
  return text.split(/\s+/).length >= 6;
}

export function extractAssets(pages: CrawledHtml[], options: { brandName?: string } = {}): ExtractedAssets {
  const images = new Map<string, RawImage>();
  const logos: { image: RawImage; score: number }[] = [];
  const inlineCss: string[] = [];
  const stylesheetUrls: string[] = [];
  const emails = new Set<string>();
  const reviewMentions: SiteReviewMention[] = [];
  const paragraphs: SiteParagraph[] = [];
  let themeColor: string | undefined;
  let siteName: string | undefined;
  const brandNorm = (options.brandName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const page of pages) {
    let base: URL;
    try {
      base = new URL(page.url);
    } catch {
      continue;
    }
    const html = page.html.slice(0, 1_500_000);
    const header = headerRanges(html);
    const pagePath = pathOf(base);

    if (page.kind === "home") {
      themeColor ??= attr(html.match(/<meta\b[^>]*name=["']theme-color["'][^>]*>/i)?.[0] ?? "", "content") || undefined;
      siteName ??= attr(html.match(/<meta\b[^>]*property=["']og:site_name["'][^>]*>/i)?.[0] ?? "", "content").slice(0, 120) || undefined;
      for (const link of html.matchAll(/<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi)) {
        const href = resolveUrl(attr(link[0], "href"), base);
        if (href && href.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "")) stylesheetUrls.push(href.toString());
      }
      const og = resolveUrl(attr(html.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/i)?.[0] ?? "", "content"), base);
      if (og && PHOTO_EXT.test(og.pathname) && !NON_PHOTO_NAME.test(og.pathname)) {
        images.set(imageKey(og.toString()), { url: og.toString(), alt: "", pageUrl: page.url, pagePath, pageKind: page.kind, placement: "og" });
      }
    }
    for (const style of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) inlineCss.push(style[1].slice(0, 200_000));

    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      const index = m.index ?? 0;
      const srcsetPick = pickFromSrcset(attr(tag, "data-srcset") || attr(tag, "srcset"));
      const rawSrc = attr(tag, "data-src") || attr(tag, "data-lazy-src") || attr(tag, "data-original") || srcsetPick?.url || attr(tag, "src");
      const url = resolveUrl(rawSrc, base);
      if (!url) continue;
      const alt = attr(tag, "alt").slice(0, 160);
      const width = srcsetPick?.width ?? toNumber(attr(tag, "width"));
      const height = srcsetPick?.width ? undefined : toNumber(attr(tag, "height"));
      const marker = `${attr(tag, "class")} ${attr(tag, "id")} ${url.pathname} ${alt}`.toLowerCase();
      const isHeader = inRanges(index, header);
      const image: RawImage = {
        url: url.toString(),
        alt,
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        pageUrl: page.url,
        pagePath,
        pageKind: page.kind,
        placement: isHeader ? "header" : "content",
      };

      if (page.kind === "home" && LOGO_EXT.test(url.pathname)) {
        let score = 0;
        if (/logo/.test(marker)) score += 5;
        if (/custom-logo|site-logo|brand/.test(marker)) score += 3;
        if (isHeader) score += 3;
        if (brandNorm.length >= 3 && alt.toLowerCase().replace(/[^a-z0-9]/g, "").includes(brandNorm)) score += 3;
        if (score >= 6) logos.push({ image: { ...image, placement: "header" }, score });
      }

      if (isHeader || !PHOTO_EXT.test(url.pathname) || NON_PHOTO_NAME.test(url.pathname)) continue;
      const sized = url.pathname.match(WP_SIZE);
      const effectiveWidth = width ?? (sized ? Number(sized[1]) : undefined);
      const effectiveHeight = height ?? (sized ? Number(sized[2]) : undefined);
      if ((effectiveWidth && effectiveWidth < 360) || (effectiveHeight && effectiveHeight < 240)) continue;
      if (/footer|partenaire|partner|client-logo|slick-cloned/.test(marker)) continue;

      const key = imageKey(image.url);
      const existing = images.get(key);
      // Keep the version seen on the most meaningful page (réalisations first).
      if (!existing || (existing.pageKind !== "realisations" && page.kind === "realisations")) images.set(key, image);
    }

    for (const m of html.matchAll(/background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
      const url = resolveUrl(m[1], base);
      if (!url || !PHOTO_EXT.test(url.pathname) || NON_PHOTO_NAME.test(url.pathname)) continue;
      const sized = url.pathname.match(WP_SIZE);
      if (sized && Number(sized[1]) < 600) continue;
      const key = imageKey(url.toString());
      if (!images.has(key)) {
        images.set(key, { url: url.toString(), alt: "", pageUrl: page.url, pagePath, pageKind: page.kind, placement: "background" });
      }
    }

    for (const m of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) {
      const email = decodeURIComponent(m[1]).trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email) && !/wix|sentry|example|domain\.|votre|your|email@/.test(email)) emails.add(email);
    }

    reviewMentions.push(...reviewMentionsIn(htmlToText(html).slice(0, 40_000), pagePath));

    const body = html.replace(/<(header|nav|footer|aside|form|script|style)\b[\s\S]*?<\/\1>/gi, " ");
    for (const m of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
      if (paragraphs.length >= 80) break;
      const text = htmlToText(m[1]).replace(/\s+/g, " ").trim();
      if (isCleanSentence(text, 40, 420)) paragraphs.push({ pagePath, pageKind: page.kind, text });
    }
  }

  logos.sort((a, b) => b.score - a.score);
  return {
    images: [...images.values()].slice(0, 60),
    paragraphs,
    logo: logos[0]?.image ?? null,
    ...(themeColor ? { themeColor } : {}),
    inlineCss: inlineCss.slice(0, 20),
    stylesheetUrls: [...new Set(stylesheetUrls)].slice(0, 3),
    ...(siteName ? { siteName } : {}),
    emails: [...emails].slice(0, 3),
    reviewMentions: reviewMentions.slice(0, 3),
  };
}

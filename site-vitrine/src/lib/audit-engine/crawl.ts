import { fetchPublicHtml, signalsFromFetch, type FetchHtmlResult } from "./probe";
import type { SiteSignals, SocialNetwork } from "./types";

/**
 * Multi-page exploration of the official site.
 *
 * A diagnostic built on the homepage alone cannot see that a service has no
 * page of its own, that the réalisations live three clicks away or that the
 * contact form asks eleven questions. This module reads the homepage, the
 * sitemap and the internal links, then opens the pages a prospect would
 * actually visit — services, local pages, réalisations, avis, contact/devis,
 * à propos, mentions légales — and extracts only observable facts from them.
 *
 * Everything is bounded (pages, bytes, per-page timeout, global budget) and
 * every request goes through `fetchPublicHtml`, which carries the SSRF
 * guards. Never throws.
 */

export type PageKind =
  | "home"
  | "service"
  | "local"
  | "realisations"
  | "avis"
  | "contact"
  | "devis"
  | "about"
  | "legal"
  | "blog"
  | "other";

export type CrawledForm = {
  /** Visible, user-fillable fields (hidden/submit excluded). */
  fieldCount: number;
  /** Human labels of the fields — label text, placeholder or name. */
  fields: string[];
};

export type CrawledPage = {
  url: string;
  path: string;
  kind: PageKind;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  /** Numbers behind href="tel:" links, normalised. */
  telLinks: string[];
  /** French phone numbers written in the visible text, normalised. */
  phones: string[];
  forms: CrawledForm[];
  /** Link/button texts carrying an action (devis, appeler, contact…). */
  ctas: string[];
  /** Words proving social proof was found: "avis", "témoignage", "★"… */
  proofMarkers: string[];
  /** Labels/certifications named in the text (RGE, Qualibat…). */
  certifications: string[];
  /** <img> tags in the main content — a proxy for photos of work. */
  imageCount: number;
  /** Full visible text, bounded. Internal only — never sent whole to a model. */
  text: string;
};

export type HomeLayout = {
  /** A phone number (tel: link or written) appears in the header area. */
  phoneInHeader: boolean;
  /** A devis/contact call to action appears in the first screen of text. */
  ctaInFirstScreen: boolean;
  /** The text of the first screen (header + hero), bounded. */
  firstScreenText: string;
  /** Position (0–100 % of the page text) of the first devis/contact CTA. */
  firstCtaPct: number | null;
  /** Position (0–100 %) of the first review/testimonial marker. */
  firstProofPct: number | null;
  /** Anchor texts of the main navigation (header/nav). */
  navLabels: string[];
};

export type SiteCrawl = {
  rootUrl: string;
  reachable: boolean;
  unreachableReason?: SiteSignals["unreachableReason"];
  /** Homepage signals, kept in the legacy shape for the deterministic analyzers. */
  homeSignals: SiteSignals;
  home: HomeLayout | null;
  pages: CrawledPage[];
  /** Internal URLs discovered (links + sitemap), deduplicated. */
  discoveredUrlCount: number;
  /** URLs listed in the sitemap, when one was found. */
  sitemapUrlCount: number | null;
  sitemapPaths: string[];
  /** Paths of every internal URL discovered (links + sitemap), bounded. */
  knownPaths: string[];
  socialLinks: Partial<Record<SocialNetwork, string>>;
  durationMs: number;
};

export type CrawlOptions = {
  fetchPage?: (url: string, opts?: { acceptXml?: boolean; timeoutMs?: number }) => Promise<FetchHtmlResult>;
  maxPages?: number;
  budgetMs?: number;
  /** Known city of the company — pages naming it are prioritised as local pages. */
  cityHint?: string;
  /**
   * Called with every page actually read (homepage included), so a caller can
   * extract more from HTML already downloaded instead of fetching it again.
   * The HTML is untrusted data: never render or execute it.
   */
  onPage?: (page: { url: string; kind: PageKind; html: string }) => void;
};

// The host cuts every request at 10 s, so the crawl works to a hard budget:
// wide concurrency, short per-page timeouts, and whatever is read when the
// budget runs out is what the diagnostic is built on.
const DEFAULT_MAX_PAGES = 12;
const DEFAULT_BUDGET_MS = 5_000;
const PAGE_TIMEOUT_MS = 3_000;
const CONCURRENCY = 8;
const MAX_TEXT = 20_000;

// ---------------------------------------------------------------------------
// Text helpers

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/gi, "’")
    .replace(/&lsquo;|&#8216;/gi, "‘")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&agrave;/gi, "à")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&icirc;/gi, "î")
    .replace(/&ucirc;/gi, "û")
    .replace(/&ugrave;/gi, "ù")
    .replace(/&hellip;/gi, "…")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return n > 31 && n < 0x10ffff ? String.fromCodePoint(n) : " ";
    })
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripNoise(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ");
}

export function htmlToText(html: string): string {
  return decodeEntities(
    stripNoise(html)
      .replace(/<(br|p|div|li|h[1-6]|section|article|header|footer|tr|td)[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function tagTexts(html: string, tag: string, max = 12): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  return [...html.matchAll(re)]
    .map((m) => htmlToText(m[1]).slice(0, 160))
    .filter(Boolean)
    .slice(0, max);
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeEntities((m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim());
}

const PHONE_RE = /(?:(?:\+|00)33[\s.-]?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/g;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+33|^0033/, "0");
  return digits.length === 10 ? digits.replace(/(\d{2})(?=\d)/g, "$1 ") : "";
}

function phonesIn(text: string): string[] {
  return [...new Set((text.match(PHONE_RE) ?? []).map(normalizePhone).filter(Boolean))].slice(0, 5);
}

const CTA_RE =
  /(devis|estimation|appel|appelez|contact|rappel|rendez-vous|rdv|demande|diagnostic gratuit|intervention|urgence|réserver|reserver|disponibilit|commander|acheter|ajouter au panier|découvrir|decouvrir|demander une démo|demander une demo|voir la démo|voir la demo|essai|s.inscrire|candidater|écrivez|ecrivez|nous joindre)/i;

const PROOF_PATTERNS: [string, RegExp][] = [
  ["avis clients", /\bavis\b/i],
  ["témoignages", /t[ée]moignages?/i],
  ["note / étoiles", /★|⭐|\b[1-5][,.]\d\s*\/\s*5\b|\d+\s+avis\b/i],
  ["avis Google", /avis google|google reviews?|trustindex|elfsight|widget-google-reviews|grw-/i],
  ["références clients", /ils nous (?:font|ont fait) confiance|nos r[ée]f[ée]rences|nos clients/i],
];

const CERTIFICATIONS: [string, RegExp][] = [
  ["RGE", /\bRGE\b|reconnu garant de l.environnement/i],
  ["Qualibat", /qualibat/i],
  ["QualiPAC", /qualipac/i],
  ["QualiPV", /qualipv/i],
  ["Qualibois", /qualibois/i],
  ["Qualifelec", /qualifelec/i],
  ["Qualigaz / PGN", /qualigaz|\bPGN\b|\bPGP\b/i],
  ["Qualit'EnR", /qualit.?enr/i],
  ["Éco Artisan", /[ée]co artisan/i],
  ["Handibat", /handibat/i],
  ["Artisan (Chambre de Métiers)", /chambre de m[ée]tiers|\bartisan\b.{0,20}\bqualifi/i],
  ["Garantie décennale", /d[ée]cennale/i],
  ["Maître Artisan", /ma[îi]tre artisan/i],
  ["Les Pros de l'Accessibilité / MaPrimeAdapt'", /primeadapt/i],
  ["Label MaPrimeRénov'", /maprimer[ée]nov/i],
  ["CEE", /certificats? d.[ée]conomies? d.[ée]nergie|\bCEE\b/i],
];

const SOCIAL_PATTERNS: Record<SocialNetwork, RegExp> = {
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore\/|share)[a-z0-9._-]+/i,
  facebook: /https?:\/\/(?:www\.|fr-fr\.|m\.)?facebook\.com\/(?!sharer|share\.php|dialog|plugins|tr\?)[a-z0-9.\-_/?=%]+/i,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[a-z0-9._-]+/i,
  linkedin: /https?:\/\/(?:[a-z]{2}\.|www\.)?linkedin\.com\/(?:company|in)\/[a-z0-9._%-]+/i,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[a-z0-9._-]+/i,
  twitter: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share)[a-z0-9_]+/i,
};

// ---------------------------------------------------------------------------
// Link discovery and page classification

type Link = { url: string; path: string; text: string; inNav: boolean };

function sameSite(a: URL, b: URL): boolean {
  return a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");
}

const ASSET_RE = /\.(?:jpe?g|png|gif|webp|svg|pdf|zip|docx?|xlsx?|mp4|mp3|css|js|xml|ico|avif)(?:$|\?)/i;
const SKIP_PATH_RE =
  /\/(?:wp-admin|wp-login|wp-json|feed|cart|panier|checkout|my-account|mon-compte|tag|author|auteur|category\/uncategorized|page\/\d+|\?s=|search|cdn-cgi)(?:\/|$)/i;

function extractLinks(html: string, base: URL): Link[] {
  const links: Link[] = [];
  const navBlocks = [
    ...[...html.matchAll(/<nav[\s\S]*?<\/nav>/gi)].map((m) => m[0]),
    ...[...html.matchAll(/<header[\s\S]*?<\/header>/gi)].map((m) => m[0]),
  ].join(" ");

  const collect = (source: string, inNav: boolean) => {
    for (const match of source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = attr(match[1], "href");
      if (!href || /^(?:#|mailto:|tel:|javascript:|sms:|whatsapp:)/i.test(href)) continue;
      let url: URL;
      try {
        url = new URL(href, base);
      } catch {
        continue;
      }
      if (!["http:", "https:"].includes(url.protocol) || !sameSite(url, base)) continue;
      if (ASSET_RE.test(url.pathname) || SKIP_PATH_RE.test(url.pathname + url.search)) continue;
      url.hash = "";
      const text = htmlToText(match[2]).slice(0, 80) || attr(match[1], "title").slice(0, 80) || attr(match[1], "aria-label").slice(0, 80);
      links.push({ url: url.toString(), path: url.pathname, text, inNav });
    }
  };
  collect(navBlocks, true);
  collect(html, false);

  const seen = new Map<string, Link>();
  for (const link of links) {
    const key = link.url.replace(/\/$/, "");
    const existing = seen.get(key);
    if (!existing) seen.set(key, link);
    else if (!existing.text && link.text) existing.text = link.text;
  }
  return [...seen.values()];
}

const KIND_RULES: [PageKind, RegExp][] = [
  ["legal", /mentions?[-_ ]?l[ée]gales|legal|cgv|conditions[-_ ]g[ée]n[ée]rales|informations[-_ ]l[ée]gales/i],
  ["devis", /devis|estimation|chiffrage|demande[-_ ]de[-_ ]prix/i],
  ["contact", /contact|nous[-_ ]joindre|coordonn[ée]es/i],
  ["realisations", /r[ée]alisations?|chantiers?|portfolio|galerie|gallery|projets?|avant[-_ ]apr[èe]s|nos[-_ ]travaux|references/i],
  ["avis", /avis|t[ée]moignages?|clients[-_ ]satisfaits|reviews?/i],
  ["about", /qui[-_ ]sommes|a[-_ ]propos|about|notre[-_ ](?:entreprise|soci[ée]t[ée]|histoire|[ée]quipe)|l[-_ ]entreprise|presentation|pr[ée]sentation/i],
  ["blog", /blog|actualit[ée]s?|actus?|news|conseils?|articles?|guide/i],
];

const PRIVACY_RE = /politique[-_ ]de[-_ ]confidentialit|privacy|cookies|rgpd|donnees[-_ ]personnelles|plan[-_ ]du[-_ ]site|sitemap/i;

const SERVICE_PATH_HINT = /(?:services?|prestations?|nos[-_ ]m[ée]tiers|metiers|expertises?|savoir[-_ ]faire|activit[ée]s?|travaux|solutions|produits?|products?|collection|boutique|shop|carte|menus?|soins?|traitements?|consultations?|fonctionnalit[ée]s?|features?|offres?|accompagnements?|biens?|properties|chambres?|rooms?|s[ée]jours?|evenements?|events?)(?:\/|$)/i;

export function classifyUrl(path: string, text: string): PageKind {
  const decodedPath = (() => {
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  })();
  if (decodedPath === "/" || decodedPath === "") return "home";
  if (PRIVACY_RE.test(decodedPath) || PRIVACY_RE.test(text)) return "other";
  const hay = `${decodedPath} ${text}`;
  for (const [kind, re] of KIND_RULES) if (re.test(hay)) return kind;
  return "other";
}

function looksLikeServiceLink(link: Link, trades: RegExp): boolean {
  const hay = normalize(`${link.path} ${link.text}`);
  return SERVICE_PATH_HINT.test(link.path) || trades.test(hay);
}

/** Broad trade vocabulary used only to prioritise which links to open. */
const TRADE_LINK_RE =
  /toiture|couverture|couvreur|zinguerie|goutti|charpent|demoussage|nettoyage|etancheit|velux|isolation|combles|facade|ravalement|enduit|plomb|chauff|chaudiere|pompe|pac|climatis|sanitaire|salle-?de-?bain|electri|borne|photovolta|solaire|menuiser|fenetre|porte|volet|portail|veranda|pergola|maconn|beton|terrassement|extension|renovation|amenagement|peinture|peintre|carrel|parquet|sol|platr|placo|cloison|plafond|cuisine|serrur|vitr|elagage|abattage|paysag|jardin|terrasse|piscine|cloture|assainissement|ramonage|poele|vmc|ventilation|desamiantage|depannage|urgence|debouchage|recherche-?de-?fuite|diagnostic|dallage|pavage|enrobe|ossature|bardage|escalier|agencement|dressing|restaurant|traiteur|reservation|carte|menu|consultation|implant|dentaire|soin|massage|produit|collection|logiciel|saas|fonctionnalite|feature|demo|agence|expertise|immobilier|estimation|bien|chambre|sejour|hotel|evenement|mariage|coaching|accompagnement|formation|boutique|showroom/;

function scoreLink(link: Link, cityNorm: string): { kind: PageKind; score: number } {
  let kind = classifyUrl(link.path, link.text);
  let score = 0;
  const hay = normalize(`${link.path} ${link.text}`);
  if (kind === "other" && looksLikeServiceLink(link, TRADE_LINK_RE)) kind = "service";
  if (cityNorm && hay.includes(cityNorm) && (kind === "other" || kind === "service")) kind = "local";

  switch (kind) {
    case "home":
      score = -1;
      break;
    case "service":
      score = 60;
      break;
    case "local":
      score = 58;
      break;
    case "devis":
      score = 55;
      break;
    case "contact":
      score = 54;
      break;
    case "realisations":
      score = 52;
      break;
    case "avis":
      score = 50;
      break;
    case "legal":
      score = 48;
      break;
    case "about":
      score = 40;
      break;
    case "blog":
      score = 8;
      break;
    default:
      score = link.inNav ? 30 : 5;
  }
  if (link.inNav) score += 10;
  // Deep article-like URLs are rarely the service pages a prospect lands on.
  if (link.path.split("/").filter(Boolean).length > 3) score -= 10;
  return { kind, score };
}

const KIND_QUOTAS: Partial<Record<PageKind, number>> = {
  service: 6,
  local: 2,
  devis: 1,
  contact: 1,
  realisations: 1,
  avis: 1,
  legal: 1,
  about: 1,
  blog: 0,
  other: 2,
};

export function selectPages(links: Link[], sitemap: string[], root: URL, max: number, cityHint = ""): { url: string; kind: PageKind }[] {
  const cityNorm = normalize(cityHint).replace(/\s+/g, "-");
  const candidates = new Map<string, { url: string; kind: PageKind; score: number }>();
  const add = (link: Link, bonus = 0) => {
    const { kind, score } = scoreLink(link, cityNorm);
    if (kind === "home") return;
    const key = link.url.replace(/\/$/, "");
    const existing = candidates.get(key);
    if (!existing || existing.score < score + bonus) candidates.set(key, { url: link.url, kind, score: score + bonus });
  };
  for (const link of links) add(link);
  for (const url of sitemap) {
    try {
      const parsed = new URL(url);
      if (!sameSite(parsed, root)) continue;
      add({ url: parsed.toString(), path: parsed.pathname, text: "", inNav: false }, -4);
    } catch {}
  }

  const sorted = [...candidates.values()].sort((a, b) => b.score - a.score);
  const picked: { url: string; kind: PageKind }[] = [];
  const used: Partial<Record<PageKind, number>> = {};
  for (const item of sorted) {
    if (picked.length >= max) break;
    const quota = KIND_QUOTAS[item.kind] ?? 1;
    if ((used[item.kind] ?? 0) >= quota) continue;
    used[item.kind] = (used[item.kind] ?? 0) + 1;
    picked.push({ url: item.url, kind: item.kind });
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Page parsing

function parseForms(html: string): CrawledForm[] {
  const forms: CrawledForm[] = [];
  for (const match of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)) {
    const body = match[1];
    // A search box is not a contact form.
    if (/type=["']search["']|name=["']s["']/i.test(body) && !/textarea/i.test(body)) continue;
    const labels = new Map<string, string>();
    for (const label of body.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)) {
      const forId = attr(label[1], "for");
      const text = htmlToText(label[2]).replace(/\*/g, "").trim();
      if (forId && text) labels.set(forId, text);
    }
    const fields: string[] = [];
    for (const field of body.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
      const tag = field[1].toLowerCase();
      const attrs = field[2];
      const type = attr(attrs, "type").toLowerCase();
      if (tag === "input" && ["hidden", "submit", "button", "image", "reset"].includes(type)) continue;
      const name = attr(attrs, "name");
      if (/honeypot|captcha|g-recaptcha|_wpcf7|nonce|token|referer|website_url|hp_|fax_only/i.test(name)) continue;
      const id = attr(attrs, "id");
      const label =
        (id && labels.get(id)) || attr(attrs, "placeholder") || attr(attrs, "aria-label") || name.replace(/[-_[\]]+/g, " ").trim() || type || tag;
      fields.push(label.slice(0, 60));
    }
    if (fields.length > 0) forms.push({ fieldCount: fields.length, fields: fields.slice(0, 20) });
  }
  return forms.slice(0, 3);
}

function parseCtas(html: string): string[] {
  const texts: string[] = [];
  for (const match of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const text = htmlToText(match[3]).slice(0, 70);
    if (text && text.length <= 70 && CTA_RE.test(text)) texts.push(text);
  }
  for (const match of html.matchAll(/<input\b([^>]*type=["']submit["'][^>]*)>/gi)) {
    const value = attr(match[1], "value");
    if (value) texts.push(value.slice(0, 70));
  }
  return [...new Set(texts)].slice(0, 10);
}

export function parsePage(html: string, url: URL, kind: PageKind): CrawledPage {
  const text = htmlToText(html).slice(0, MAX_TEXT);
  const title = htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 200);
  const meta = attr(html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0] ?? "", "content").slice(0, 300);
  const telLinks = [
    ...new Set([...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map((m) => normalizePhone(decodeURIComponent(m[1]))).filter(Boolean)),
  ];
  const bodyHtml = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const mainHtml = stripNoise(bodyHtml).replace(/<header[\s\S]*?<\/header>|<footer[\s\S]*?<\/footer>/gi, " ");

  return {
    url: url.toString(),
    path: url.pathname,
    kind,
    title,
    metaDescription: meta,
    h1: tagTexts(html, "h1", 3),
    h2: tagTexts(html, "h2", 12),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    telLinks,
    phones: phonesIn(text),
    forms: parseForms(html),
    ctas: parseCtas(bodyHtml),
    proofMarkers: PROOF_PATTERNS.filter(([, re]) => re.test(text) || re.test(html.slice(0, 400_000))).map(([label]) => label),
    certifications: CERTIFICATIONS.filter(([, re]) => re.test(text)).map(([label]) => label),
    imageCount: (mainHtml.match(/<img\b/gi) ?? []).length,
    text,
  };
}

function firstMatchPct(text: string, re: RegExp): number | null {
  const index = text.search(re);
  if (index < 0 || text.length === 0) return null;
  return Math.round((index / text.length) * 100);
}

export function parseHomeLayout(html: string): HomeLayout {
  const body = stripNoise(html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html);
  const headerHtml = body.match(/<header[\s\S]*?<\/header>/i)?.[0] ?? body.slice(0, Math.max(2_500, Math.round(body.length * 0.08)));
  const headerText = htmlToText(headerHtml);
  const phoneInHeader = /href=["']tel:/i.test(headerHtml) || phonesIn(headerText).length > 0;

  const text = htmlToText(body);
  // "First screen" ≈ header plus the first ~70 words of the hero.
  const afterHeader = htmlToText(body.replace(/<header[\s\S]*?<\/header>/i, " "));
  const heroText = afterHeader.split(/\s+/).slice(0, 70).join(" ");
  const firstScreenText = `${headerText.slice(0, 400)} ${heroText}`.trim().slice(0, 900);

  const navLabels = [
    ...new Set(
      [...(body.match(/<nav[\s\S]*?<\/nav>/gi) ?? [headerHtml])]
        .join(" ")
        .match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)
        ?.map((a) => htmlToText(a).slice(0, 60))
        .filter((label) => label && label.length > 1) ?? []
    ),
  ].slice(0, 25);

  return {
    phoneInHeader,
    ctaInFirstScreen: /devis|contact|appel|rappel|rendez-vous|estimation|demande/i.test(firstScreenText),
    firstScreenText,
    firstCtaPct: firstMatchPct(text, /devis|demande[rz]? (?:un|votre)|contactez|appelez/i),
    firstProofPct: firstMatchPct(text, /t[ée]moignages?|avis (?:clients?|google|de nos)|ils nous font confiance|★|⭐|\d+\s+avis\b|[1-5][,.]\d\s*\/\s*5/i),
    navLabels,
  };
}

function parseSitemap(xml: string): { pages: string[]; children: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decodeEntities(m[1].trim()));
  const isIndex = /<sitemapindex/i.test(xml);
  return isIndex ? { pages: [], children: locs } : { pages: locs.filter((loc) => !ASSET_RE.test(loc)), children: [] };
}

function socialLinksIn(htmls: string[]): Partial<Record<SocialNetwork, string>> {
  const found: Partial<Record<SocialNetwork, string>> = {};
  for (const html of htmls) {
    for (const [network, re] of Object.entries(SOCIAL_PATTERNS) as [SocialNetwork, RegExp][]) {
      if (found[network]) continue;
      const match = html.match(re);
      if (match) found[network] = match[0].replace(/[/?]+$/, "");
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Orchestration

async function withBudget<T>(items: T[], worker: (item: T) => Promise<void>, deadline: number): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0 && Date.now() < deadline - 500) {
      const item = queue.shift()!;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function crawlSite(rawUrl: string, options: CrawlOptions = {}): Promise<SiteCrawl> {
  const started = Date.now();
  const budget = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const deadline = started + budget;
  const fetchPage =
    options.fetchPage ?? ((url: string, opts?: { acceptXml?: boolean; timeoutMs?: number }) => fetchPublicHtml(url, opts));
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const remaining = () => Math.max(1_000, Math.min(PAGE_TIMEOUT_MS, deadline - Date.now()));

  const homeFetch = await fetchPage(rawUrl, { timeoutMs: Math.min(4_000, budget) });
  const homeSignals = signalsFromFetch(homeFetch);
  if (!homeFetch.ok) {
    return {
      rootUrl: rawUrl,
      reachable: false,
      unreachableReason: homeFetch.reason,
      homeSignals,
      home: null,
      pages: [],
      discoveredUrlCount: 0,
      sitemapUrlCount: null,
      sitemapPaths: [],
      knownPaths: [],
      socialLinks: {},
      durationMs: Date.now() - started,
    };
  }

  const root = homeFetch.finalUrl;
  const homePage = parsePage(homeFetch.html, root, "home");
  options.onPage?.({ url: root.toString(), kind: "home", html: homeFetch.html });
  const links = extractLinks(homeFetch.html, root);

  // Sitemap: robots.txt is not needed — the conventional locations cover
  // WordPress, Wix, Squarespace, Jimdo and most static generators.
  let sitemapPages: string[] = [];
  let sitemapFound = false;
  for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]) {
    if (Date.now() > deadline - 2_000) break;
    const result = await fetchPage(new URL(path, root).toString(), { acceptXml: true, timeoutMs: Math.min(2_500, remaining()) });
    if (!result.ok || !/<(urlset|sitemapindex)/i.test(result.html)) continue;
    sitemapFound = true;
    const parsed = parseSitemap(result.html);
    sitemapPages = parsed.pages;
    const children = parsed.children
      .filter((loc) => !/image|video|author|tag|categor|product_cat|attachment/i.test(loc))
      .sort((a, b) => Number(/page/i.test(b)) - Number(/page/i.test(a)))
      .slice(0, 3);
    const childResults = await Promise.all(
      children.map((child) => fetchPage(child, { acceptXml: true, timeoutMs: Math.min(2_500, remaining()) }))
    );
    for (const child of childResults) if (child.ok) sitemapPages.push(...parseSitemap(child.html).pages);
    break;
  }
  sitemapPages = [...new Set(sitemapPages)].slice(0, 400);

  const selection = selectPages(links, sitemapPages, root, maxPages - 1, options.cityHint);
  const pages: CrawledPage[] = [homePage];
  const htmls: string[] = [homeFetch.html];

  await withBudget(
    selection,
    async (item) => {
      const result = await fetchPage(item.url, { timeoutMs: remaining() });
      if (!result.ok || !sameSite(result.finalUrl, root)) return;
      const finalKey = result.finalUrl.toString().replace(/\/$/, "");
      if (pages.some((page) => page.url.replace(/\/$/, "") === finalKey)) return;
      pages.push(parsePage(result.html, result.finalUrl, item.kind));
      htmls.push(result.html);
      options.onPage?.({ url: result.finalUrl.toString(), kind: item.kind, html: result.html });
    },
    deadline
  );

  // Local pages are recognised after reading them: title/H1 naming the city.
  const cityNorm = normalize(options.cityHint ?? "");
  for (const page of pages) {
    if (page.kind !== "service" && page.kind !== "other") continue;
    const head = normalize(`${page.title} ${page.h1.join(" ")} ${page.path.replace(/[-_/]/g, " ")}`);
    if (cityNorm && head.includes(cityNorm) && page.kind === "other") page.kind = "local";
  }

  const discovered = new Set([...links.map((l) => l.url.replace(/\/$/, "")), ...sitemapPages.map((u) => u.replace(/\/$/, ""))]);

  return {
    rootUrl: root.toString(),
    reachable: true,
    homeSignals,
    home: parseHomeLayout(homeFetch.html),
    pages,
    discoveredUrlCount: discovered.size,
    sitemapUrlCount: sitemapFound ? sitemapPages.length : null,
    sitemapPaths: sitemapPages
      .map((u) => {
        try {
          return new URL(u).pathname;
        } catch {
          return "";
        }
      })
      .filter(Boolean)
      .slice(0, 60),
    knownPaths: [...discovered]
      .map((u) => {
        try {
          return new URL(u).pathname;
        } catch {
          return "";
        }
      })
      .filter(Boolean)
      .slice(0, 400),
    socialLinks: socialLinksIn(htmls),
    durationMs: Date.now() - started,
  };
}

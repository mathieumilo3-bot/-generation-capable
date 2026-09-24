import type { CompanyDiscoveryCandidate } from "@/lib/audit-engine/company-discovery";
import type { RegistryCandidate } from "@/lib/audit-engine/company-registry";
import { normalize } from "@/lib/audit-engine/crawl";
import { toAuditContext, type DiagnosticResult, type Dossier, type ResearchNotes } from "@/lib/audit-engine/diagnostic";
import type { AiAuditWebSource } from "@/lib/audit-engine/types";
import { SERVICES } from "@/lib/audit-engine/facts";
import { isCleanSentence, type ExtractedAssets, type RawImage, type SiteParagraph } from "./assets";
import { detectTradeFamily, NAF_LABELS, TRADE_FAMILIES } from "./trades";
import type { Fact, PortfolioAsset, ReviewFact, ServiceFact, TrustFact, VerifiedCompanyProfile } from "./types";

export type ProfileInputs = {
  typedName: string;
  userCity?: string;
  registry?: RegistryCandidate | null;
  discovery?: CompanyDiscoveryCandidate | null;
  dossier: Dossier;
  assets?: ExtractedAssets | null;
  observedColors?: string[];
  research?: ResearchNotes | null;
  diagnostic: DiagnosticResult;
  now?: Date;
};

const REGISTRY_SOURCE = "Registre national des entreprises (annuaire-entreprises.data.gouv.fr)";

function observedFact<T>(value: T, source: string): Fact<T> {
  return { value, source, confidence: "observed" };
}
function inferredFact<T>(value: T, source: string): Fact<T> {
  return { value, source, confidence: "inferred" };
}

const LEGAL_FORMS = new Set(["sarl", "sas", "sasu", "eurl", "sa", "sci", "eirl"]);
const SMALL_WORDS = new Set(["de", "du", "des", "la", "le", "les", "et", "sur", "sous", "en", "d", "l", "à", "aux"]);

/** "BASTELICACCIA" → "Bastelicaccia", "SAINT-MARTIN-LA-PALLU" → "Saint-Martin-la-Pallu". Mixed case is kept. */
export function displayCase(value: string): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || text !== text.toUpperCase() || !/[A-Z]/.test(text)) return text;
  // A single short token is an acronym ("AATP", "BRP"): keep it as written.
  if (/^[A-Z0-9&.]{2,5}$/.test(text)) return text;
  let index = 0;
  return text.replace(/[\p{L}\p{N}]+/gu, (raw) => {
    const first = index++ === 0;
    const word = raw.toLowerCase();
    if (LEGAL_FORMS.has(word) || raw.length <= 3 && !/[AEIOUY]/.test(raw)) return raw;
    if (!first && SMALL_WORDS.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

function cleanName(value: string): string {
  return value
    .replace(/\s*[|–—-]\s*(accueil|home|site officiel)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isGenericSiteName(name: string, domain: string): boolean {
  const n = normalize(name);
  return n.length < 2 || /^(accueil|home|site|wordpress|wix|mon site|my site|jimdo)$/.test(n) || n === normalize(domain);
}

function pickPublicName(input: ProfileInputs, officialDomain: string): Fact<string> {
  const siteName = input.assets?.siteName ? cleanName(input.assets.siteName) : "";
  const verifiedSite = Boolean(input.discovery?.verification?.verified);
  if (siteName && verifiedSite && !isGenericSiteName(siteName, officialDomain)) {
    return observedFact(displayCase(siteName), `nom publié sur ${officialDomain} (og:site_name)`);
  }
  if (input.registry?.commercialName) return observedFact(displayCase(input.registry.commercialName), `${REGISTRY_SOURCE} — nom commercial`);
  if (input.discovery?.name && input.discovery.confidence !== "low") {
    return inferredFact(displayCase(cleanName(input.discovery.name)), "identification sur sources publiques");
  }
  if (input.registry?.name) return observedFact(displayCase(input.registry.name), `${REGISTRY_SOURCE} — dénomination`);
  return { value: displayCase(input.typedName.trim().slice(0, 80)), source: "nom saisi", confidence: "inferred" };
}

function tradeLabel(sector: string): string {
  return sector.replace(/^autre\s*[—–-]\s*/i, "").split("/")[0].trim();
}

/** A profile URL counts only if the web-search tool actually returned it. */
function citedBySearch(url: string, sources: AiAuditWebSource[]): boolean {
  const host = hostOf(url);
  let path = "";
  try {
    path = new URL(url).pathname.replace(/\/$/, "").toLowerCase();
  } catch {
    return false;
  }
  return sources.some((source) => {
    if (hostOf(source.url) !== host) return false;
    try {
      const sourcePath = new URL(source.url).pathname.replace(/\/$/, "").toLowerCase();
      return path.length > 1 && (sourcePath.startsWith(path) || path.startsWith(sourcePath) && sourcePath.length > 1);
    } catch {
      return false;
    }
  });
}

const PLATFORM_OF: [RegExp, string][] = [
  [/google\.[a-z.]+\/maps|g\.page|business\.google|maps\.app\.goo\.gl/i, "Google"],
  [/pagesjaunes\.fr/i, "PagesJaunes"],
  [/facebook\.com/i, "Facebook"],
  [/instagram\.com/i, "Instagram"],
  [/linkedin\.com/i, "LinkedIn"],
  [/houzz\./i, "Houzz"],
  [/trustpilot\./i, "Trustpilot"],
];

function platformOf(url: string): string | null {
  return PLATFORM_OF.find(([re]) => re.test(url))?.[1] ?? null;
}

function portfolioFrom(images: RawImage[]): PortfolioAsset[] {
  const rank = (image: RawImage) =>
    (image.pageKind === "realisations" ? 40 : image.pageKind === "service" || image.pageKind === "local" ? 25 : image.pageKind === "home" ? 20 : 10) +
    (image.placement === "content" ? 6 : image.placement === "og" ? 3 : 0) +
    (image.width && image.width >= 900 ? 4 : 0) +
    (image.alt ? 2 : 0);
  return [...images]
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 12)
    .map((image, index) => ({
      id: `img_${index + 1}`,
      url: image.url,
      alt: image.alt,
      ...(image.width ? { width: image.width } : {}),
      ...(image.height ? { height: image.height } : {}),
      type: image.pageKind === "realisations" ? "realisation" : "site",
      pagePath: image.pagePath,
      source: `photo publiée sur ${hostOf(image.pageUrl)}${image.pagePath === "/" ? "" : image.pagePath}`,
    }));
}

function sentencesOf(text: string): string[] {
  return text.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

/**
 * The sentence of the site that best describes a service: taken from a real
 * paragraph (its dedicated page first), never from the navigation. Returns ""
 * when no clean sentence exists — the service then shows no description.
 */
function serviceSentence(label: string, dedicatedPage: string | undefined, paragraphs: SiteParagraph[], fallback: string): string {
  const def = SERVICES.find((s) => s.label === label);
  if (def) {
    const ordered = [...paragraphs].sort((a, b) => Number(b.pagePath === dedicatedPage) - Number(a.pagePath === dedicatedPage));
    for (const paragraph of ordered) {
      const sentence = sentencesOf(paragraph.text).find((s) => def.re.test(s) && isCleanSentence(s, 30, 220));
      if (sentence) return sentence;
    }
  }
  const cleaned = fallback.replace(/^…|…$/g, "").trim();
  return isCleanSentence(cleaned, 30, 220) ? cleaned : "";
}

function cleanQuote(value: string): string {
  const cleaned = value.replace(/^…|…$/g, "").trim();
  return isCleanSentence(cleaned, 20, 260) ? cleaned : "";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function streetOf(address: string): string {
  // "12 RUE DES LILAS 20129 BASTELICACCIA" → "12 rue des lilas"
  return normalize(address.replace(/\b\d{5}\b[\s\S]*$/, "")).trim();
}

export function buildVerifiedProfile(input: ProfileInputs): VerifiedCompanyProfile {
  const { dossier, registry, discovery, assets, research, diagnostic } = input;
  const facts = dossier.facts;
  const haystack = toAuditContext(dossier).haystack;
  const officialUrl = dossier.company.siteUrl || discovery?.website || "";
  const officialDomain = dossier.company.domain || hostOf(officialUrl);
  const hasSite = Boolean(officialUrl);
  const siteReadable = dossier.site.reachable;
  const pagesRead = dossier.site.pages.length;
  const webSources = research?.webSources ?? [];

  // --- identity ------------------------------------------------------------
  const sector = discovery?.sector ? tradeLabel(discovery.sector) : "";
  const tradeFamily = detectTradeFamily({
    sector,
    naf: registry?.naf,
    services: facts?.services.map((s) => s.label) ?? [],
    hints: [officialDomain, facts?.homeTitle ?? "", input.typedName],
  });
  const family = TRADE_FAMILIES[tradeFamily];
  const trade: Fact<string> = sector && !/^autre$/i.test(sector)
    ? inferredFact(sector, "activité identifiée sur sources publiques")
    : registry?.naf && NAF_LABELS[registry.naf]
      ? observedFact(family.label, `${REGISTRY_SOURCE} — code NAF ${registry.naf}`)
      : inferredFact(family.label, "déduit des services publiés");

  const city: Fact<string> | undefined = registry?.city
    ? observedFact(displayCase(registry.city), `${REGISTRY_SOURCE} — siège`)
    : discovery?.city
      ? inferredFact(displayCase(discovery.city), "identification sur sources publiques")
      : input.userCity
        ? { value: displayCase(input.userCity), source: "ville indiquée par le visiteur", confidence: "observed" }
        : undefined;

  const street = registry?.address ? streetOf(registry.address) : "";
  const addressOnSite = street.length >= 8 && haystack.includes(street);
  const foundedYear = registry?.createdOn ? registry.createdOn.slice(0, 4) : "";

  // --- branding ------------------------------------------------------------
  const logo: PortfolioAsset | undefined = assets?.logo
    ? {
        id: "logo",
        url: assets.logo.url,
        alt: assets.logo.alt,
        type: "logo",
        pagePath: "/",
        source: `logo affiché sur ${officialDomain}`,
      }
    : undefined;

  // --- contacts ------------------------------------------------------------
  const phone = facts?.contact.phone || "";
  const allPhones = [...new Set(dossier.site.pages.flatMap((p) => p.telLinks))].filter((p) => p !== phone);
  const email = assets?.emails.find((e) => officialDomain && e.endsWith(`@${officialDomain}`)) ?? assets?.emails[0];
  const socials = Object.entries(dossier.site.socialLinks).map(([network, url]) => ({ network, url }));
  for (const profileRef of research?.profiles ?? []) {
    const platform = platformOf(profileRef.url);
    if (!platform || !citedBySearch(profileRef.url, webSources)) continue;
    if (!socials.some((s) => hostOf(s.url) === hostOf(profileRef.url))) socials.push({ network: platform.toLowerCase(), url: profileRef.url });
  }

  // --- services ------------------------------------------------------------
  const services: ServiceFact[] = (facts?.services ?? []).slice(0, 8).map((service, index) => ({
    id: `svc_${index + 1}`,
    name: capitalize(service.label),
    quote: serviceSentence(service.label, service.dedicatedPage, assets?.paragraphs ?? [], service.quote),
    ...(service.dedicatedPage ? { dedicatedPage: service.dedicatedPage } : {}),
    source: `mentionné sur ${officialDomain}${service.mentionedOn[0] && service.mentionedOn[0] !== "/" ? service.mentionedOn[0] : ""}`,
    confidence: "observed",
  }));
  if (services.length < 3) {
    for (const outside of research?.servicesOutsideSite ?? []) {
      if (services.length >= 6) break;
      const name = capitalize(outside.replace(/\.$/, "").trim().slice(0, 60));
      if (!name || services.some((s) => normalize(s.name) === normalize(name))) continue;
      services.push({ id: `svc_${services.length + 1}`, name, quote: "", source: "présenté sur vos profils publics", confidence: "inferred" });
    }
  }
  if (services.length === 0 && registry?.naf && NAF_LABELS[registry.naf]) {
    services.push({ id: "svc_1", name: NAF_LABELS[registry.naf], quote: "", source: `${REGISTRY_SOURCE} — activité principale`, confidence: "observed" });
  }

  // --- trust ---------------------------------------------------------------
  const trustItems: TrustFact[] = (facts?.proof.certifications ?? []).map((label, index) => ({
    id: `trust_${index + 1}`,
    label,
    kind: /d[ée]cennale/i.test(label) ? "insurance" : /chambre de m/i.test(label) ? "membership" : "certification",
    source: `mentionné sur ${officialDomain}${facts?.proof.certificationPage ?? ""}`,
    confidence: "observed",
  }));
  if (registry?.siren) {
    trustItems.push({
      id: "trust_registry",
      label: "Entreprise immatriculée",
      kind: "registry",
      source: `${REGISTRY_SOURCE} — SIREN ${registry.siren}`,
      confidence: "observed",
    });
  }

  // --- reviews: numbers only when a page of the site displays them --------
  const reviews: ReviewFact[] = [];
  for (const mention of assets?.reviewMentions ?? []) {
    if (reviews.some((r) => r.platform === mention.platform)) continue;
    reviews.push({
      id: `rev_${reviews.length + 1}`,
      platform: mention.platform,
      ...(mention.rating ? { rating: mention.rating } : {}),
      ...(mention.count ? { count: mention.count } : {}),
      source: `affiché sur ${officialDomain}${mention.pagePath === "/" ? "" : mention.pagePath}`,
      confidence: "observed",
    });
  }
  // A review profile the search really visited: its existence is shown, never a score.
  for (const profileRef of research?.profiles ?? []) {
    const platform = platformOf(profileRef.url);
    if (!platform || !["Google", "PagesJaunes", "Houzz", "Trustpilot"].includes(platform)) continue;
    if (!citedBySearch(profileRef.url, webSources) || reviews.some((r) => r.platform === platform)) continue;
    reviews.push({ id: `rev_${reviews.length + 1}`, platform, source: `profil ${platform} consulté pendant la recherche`, confidence: "inferred" });
  }

  const observedColors = input.observedColors?.length ? observedFact(input.observedColors, `couleurs utilisées sur ${officialDomain}`) : null;
  const level = !hasSite ? "C" : !siteReadable || pagesRead <= 1 ? "B" : "A";

  return {
    v: 1,
    generatedAt: (input.now ?? new Date()).toISOString(),
    presence: { level, hasSite, siteReadable, pagesRead },
    identity: {
      publicName: pickPublicName(input, officialDomain),
      ...(registry?.legalName || registry?.name
        ? { legalName: observedFact(displayCase(registry.legalName || registry.name), `${REGISTRY_SOURCE} — dénomination`) }
        : {}),
      ...(registry?.siren ? { siren: observedFact(registry.siren, REGISTRY_SOURCE) } : {}),
      ...(city ? { city } : {}),
      ...(registry?.postalCode ? { postcode: observedFact(registry.postalCode, `${REGISTRY_SOURCE} — siège`) } : {}),
      ...(addressOnSite && registry?.address ? { address: observedFact(displayCase(registry.address), `${REGISTRY_SOURCE} + publié sur ${officialDomain}`) } : {}),
      trade,
      tradeFamily,
      ...(officialDomain && hasSite ? { officialDomain: observedFact(officialDomain, discovery?.verification?.verified ? "domaine vérifié (nom, ville, mentions légales)" : "site officiel identifié") } : {}),
      ...(officialUrl ? { officialUrl: observedFact(officialUrl, "site officiel") } : {}),
      ...(foundedYear ? { foundedYear: observedFact(foundedYear, `${REGISTRY_SOURCE} — date de création`) } : {}),
      ...(registry?.naf ? { naf: observedFact(registry.naf, REGISTRY_SOURCE) } : {}),
    },
    branding: {
      ...(logo ? { logo } : {}),
      observedColors,
      ...(facts?.homeTitle ? { siteTitle: observedFact(facts.homeTitle, `balise <title> de ${officialDomain}`) } : {}),
    },
    contacts: {
      ...(phone ? { phone: observedFact(phone, `affiché sur ${officialDomain}`) } : {}),
      otherPhones: allPhones.slice(0, 3),
      ...(email ? { email: observedFact(email, `lien e-mail publié sur ${officialDomain}`) } : {}),
      socials: socials.slice(0, 6),
      hasQuoteForm: Boolean(facts?.contact.mainForm),
    },
    services,
    areas: {
      ...(city ? { base: city } : {}),
      ...(facts?.zoneQuote && cleanQuote(facts.zoneQuote) ? { zoneQuote: observedFact(cleanQuote(facts.zoneQuote), `texte publié sur ${officialDomain}`) } : {}),
      localPages: (facts?.localPages ?? []).slice(0, 6),
    },
    trust: {
      items: trustItems,
      legalNotice: Boolean(facts?.legal.page),
      ...(facts?.proof.experienceQuote && cleanQuote(facts.proof.experienceQuote)
        ? { experienceQuote: observedFact(cleanQuote(facts.proof.experienceQuote), `texte publié sur ${officialDomain}`) }
        : {}),
    },
    reviews: reviews.slice(0, 3),
    portfolioAssets: portfolioFrom(assets?.images ?? []),
    audit: {
      levers: diagnostic.cards.slice(0, 3).map((card, index) => ({
        id: `lever_${index + 1}`,
        axis: card.axis,
        title: card.title,
        finding: card.finding,
        fix: card.fix,
        basis: card.basis,
      })),
      summary: diagnostic.summary,
      mode: diagnostic.mode,
      ...(research?.identityCheck ? { researchIdentityCheck: research.identityCheck } : {}),
    },
  };
}

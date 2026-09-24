import { normalize, type CrawledPage, type SiteCrawl } from "./crawl";

/**
 * Turns a crawl into verifiable facts about ONE company, then into
 * diagnostic cards that name what was actually seen.
 *
 * The cards produced here are the floor of the diagnostic: they are what
 * ships if the AI layer is unavailable, and they are handed to the AI as
 * pre-verified observations it can keep, sharpen or outrank with web
 * research. Every sentence carries a detail taken from the site (a page
 * path, a quoted heading, a service name, a field count) — a card that
 * cannot name such a detail is not produced.
 */

export type Axis = "trouve" | "choisi" | "contacte";
export type Potential = "faible" | "moyen" | "fort" | "très fort";

export type DiagnosticCard = {
  id: string;
  axis: Axis;
  /** Short problem title, e.g. "Visibilité du service isolation extérieure". */
  title: string;
  /** Heuristic 1–10 — never a Google, traffic or conversion measure. */
  score: number;
  /** One or two sentences: what was actually found. */
  finding: string;
  /** One concrete observed proof. */
  seen: string;
  /** Commercial consequence today, without invented numbers. */
  loss: string;
  potential: Potential;
  /** What fixing it could bring back, qualitatively. */
  potentialText: string;
  /** One concrete, immediately understandable action. */
  fix: string;
  /** Where the evidence comes from. */
  basis: "site" | "recherche" | "site + recherche";
  /** Internal ranking weight (commercial impact), not displayed. */
  weight?: number;
};

export const AXIS_LABELS: Record<Axis, string> = {
  trouve: "Être trouvé",
  choisi: "Être choisi",
  contacte: "Être contacté",
};

export function potentialForScore(score: number): Potential {
  if (score <= 3) return "très fort";
  if (score <= 5) return "fort";
  if (score <= 7) return "moyen";
  return "faible";
}

// ---------------------------------------------------------------------------
// Service vocabulary (artisans / BTP / services locaux)

type ServiceDef = { label: string; re: RegExp; slug: RegExp };

export const SERVICES: ServiceDef[] = [
  { label: "isolation extérieure", re: /isolation (?:thermique )?(?:par l.)?ext[ée]rieur|\bite\b/i, slug: /isolation-?(?:thermique-?)?(?:par-?l-?)?exterieur|\bite\b/ },
  { label: "isolation des combles", re: /isolation (?:des |de vos )?combles|combles perdus|soufflage/i, slug: /combles|soufflage/ },
  { label: "isolation intérieure", re: /isolation (?:thermique )?(?:par l.)?int[ée]rieur/i, slug: /isolation-?(?:par-?l-?)?interieur/ },
  { label: "ravalement de façade", re: /ravalement/i, slug: /ravalement/ },
  { label: "nettoyage de façade", re: /nettoyage (?:de |des )?fa[çc]ades?/i, slug: /nettoyage-?(?:de-?|des-?)?facade/ },
  { label: "démoussage de toiture", re: /d[ée]moussage|traitement (?:de |des )?toitures?|hydrofuge/i, slug: /demoussage|traitement-?(?:de-?)?toiture|hydrofuge/ },
  { label: "zinguerie et gouttières", re: /zinguerie|goutti[èe]res?/i, slug: /zinguerie|gouttiere/ },
  { label: "charpente", re: /charpente/i, slug: /charpent/ },
  { label: "réfection de toiture", re: /r[ée]fection (?:de |complète de |totale de )?(?:la |votre )?toiture|r[ée]novation de toiture/i, slug: /refection|renovation-?(?:de-?)?toiture/ },
  { label: "réparation de fuite de toiture", re: /fuites? (?:de |sur )?(?:la )?toiture|r[ée]paration (?:de )?toiture|recherche de fuite/i, slug: /fuite|reparation-?(?:de-?)?toiture/ },
  { label: "fenêtres de toit / Velux", re: /velux|fen[êe]tres? de toit/i, slug: /velux|fenetre-?de-?toit/ },
  { label: "étanchéité toit-terrasse", re: /[ée]tanch[ée]it[ée]|toit(?:ure)?[- ]terrasse/i, slug: /etancheite|toit-?terrasse/ },
  { label: "pompe à chaleur", re: /pompes? [àa] chaleur|\bpac\b (?:air|g[ée]o)/i, slug: /pompe-?a-?chaleur|\bpac\b/ },
  { label: "chaudière", re: /chaudi[èe]res?/i, slug: /chaudiere/ },
  { label: "climatisation", re: /climatis(?:ation|eur)/i, slug: /climatis/ },
  { label: "chauffe-eau / ballon thermodynamique", re: /chauffe-eau|ballon (?:d.eau chaude|thermodynamique)/i, slug: /chauffe-?eau|ballon/ },
  { label: "plancher chauffant", re: /plancher chauffant/i, slug: /plancher-?chauffant/ },
  { label: "salle de bain", re: /salles? de bains?|douche (?:italienne|[àa] l.italienne)/i, slug: /salle-?de-?bain|douche/ },
  { label: "dépannage urgent", re: /d[ée]pannage|urgence 24|24 ?h ?\/ ?24|intervention rapide/i, slug: /depannage|urgence/ },
  { label: "débouchage / canalisations", re: /d[ée]bouchage|canalisations?/i, slug: /debouchage|canalisation/ },
  { label: "mise aux normes électriques", re: /mise aux normes|tableau [ée]lectrique|consuel/i, slug: /mise-?aux-?normes|tableau-?electrique/ },
  { label: "borne de recharge", re: /bornes? de recharge|\birve\b/i, slug: /borne|irve/ },
  { label: "panneaux photovoltaïques", re: /photovolta[iï]que|panneaux? solaires?/i, slug: /photovolta|solaire/ },
  { label: "domotique / alarme", re: /domotique|alarme|vid[ée]osurveillance/i, slug: /domotique|alarme|videosurveillance/ },
  { label: "fenêtres et menuiseries", re: /menuiseries? (?:ext[ée]rieures?|pvc|alu)|fen[êe]tres? (?:pvc|alu|bois)|changement de fen[êe]tres?/i, slug: /fenetre|menuiserie/ },
  { label: "volets et stores", re: /volets? roulants?|stores? bannes?|volets? battants?/i, slug: /volet|(?:^|-)stores?(?:-|$)/ },
  { label: "portails et clôtures", re: /portails?|cl[ôo]tures?/i, slug: /portail|cloture/ },
  { label: "vérandas / pergolas", re: /v[ée]randas?|pergolas?/i, slug: /veranda|pergola/ },
  { label: "extension / agrandissement", re: /extensions? de maison|agrandissement|sur[ée]l[ée]vation|extension (?:bois|ossature)/i, slug: /extension|agrandissement|surelevation/ },
  { label: "maçonnerie", re: /ma[çc]onnerie/i, slug: /maconnerie/ },
  { label: "terrassement", re: /terrassement/i, slug: /terrassement/ },
  { label: "assainissement", re: /assainissement|fosses? septiques?|micro-station/i, slug: /assainissement|fosse/ },
  { label: "rénovation énergétique", re: /r[ée]novation [ée]nerg[ée]tique|maprimer[ée]nov/i, slug: /renovation-?energetique|maprimerenov/ },
  { label: "rénovation intérieure", re: /r[ée]novation (?:int[ée]rieure|d.int[ée]rieur|de maison|compl[èe]te|d.appartement)/i, slug: /renovation-?(?:interieure|maison|appartement|complete)/ },
  { label: "peinture intérieure", re: /peintures? int[ée]rieures?|travaux de peinture/i, slug: /peinture-?interieur/ },
  { label: "peinture extérieure / façade", re: /peintures? (?:ext[ée]rieures?|de fa[çc]ade)/i, slug: /peinture-?(?:exterieur|facade)/ },
  { label: "carrelage", re: /carrelage|fa[ïi]ence/i, slug: /carrelage|faience/ },
  { label: "parquet et revêtements de sol", re: /parquet|rev[êe]tements? de sols?|sol souple/i, slug: /parquet|(?:^|-)sols?(?:-|$)|revetement/ },
  { label: "plâtrerie / plaquiste", re: /pl[âa]trerie|plaquiste|placo|cloisons?|faux plafonds?/i, slug: /platrerie|plaquiste|placo|cloison|plafond/ },
  { label: "cuisine sur mesure", re: /cuisines? (?:sur mesure|[ée]quip[ée]es?|am[ée]nag[ée]es?)/i, slug: /cuisine/ },
  { label: "dressing / agencement", re: /dressing|agencement/i, slug: /dressing|agencement/ },
  { label: "escaliers", re: /escaliers?/i, slug: /escalier/ },
  { label: "élagage / abattage", re: /[ée]lagage|abattage/i, slug: /elagage|abattage/ },
  { label: "entretien de jardin", re: /entretien (?:de |des )?(?:jardins?|espaces verts)|tonte|taille de haies?/i, slug: /entretien-?(?:de-?|des-?)?(?:jardin|espaces-?verts)|tonte|taille-?de-?haie/ },
  { label: "aménagement paysager", re: /am[ée]nagement paysager|cr[ée]ation de jardins?|paysagiste/i, slug: /paysag|creation-?de-?jardin/ },
  { label: "terrasse", re: /terrasses? (?:bois|composite|carrel[ée]e|en pierre)|cr[ée]ation de terrasses?/i, slug: /terrasse/ },
  { label: "piscine", re: /piscines?/i, slug: /piscine/ },
  { label: "allées / pavage / enrobé", re: /pavage|enrob[ée]|all[ée]es? (?:de jardin|carrossables?)|dallage/i, slug: /pavage|enrobe|allee|dallage/ },
  { label: "serrurerie", re: /serrurerie|serrures?|ouverture de porte/i, slug: /serrur/ },
  { label: "vitrerie", re: /vitrerie|vitrages?|double vitrage/i, slug: /vitr/ },
  { label: "désamiantage", re: /d[ée]samiantage|amiante/i, slug: /amiante/ },
  { label: "ramonage", re: /ramonage/i, slug: /ramonage/ },
  { label: "poêle à bois / granulés", re: /po[êe]les? (?:[àa] bois|[àa] granul[ée]s|[àa] pellets?)|insert/i, slug: /poele|insert|granule/ },
  { label: "VMC / ventilation", re: /\bvmc\b|ventilation/i, slug: /vmc|ventilation/ },
  { label: "bardage", re: /bardage/i, slug: /bardage/ },
];

// ---------------------------------------------------------------------------
// Facts

export type ServiceFact = {
  label: string;
  /** Paths of the crawled pages whose text mentions it. */
  mentionedOn: string[];
  /** A page whose URL, title or H1 is about this service. */
  dedicatedPage?: string;
  /** Short quote from the site around the first mention. */
  quote: string;
  /** Mentioned in the homepage or navigation. */
  onHome: boolean;
};

export type SiteFacts = {
  domain: string;
  pagesAnalyzed: number;
  pagePaths: string[];
  sitemapUrlCount: number | null;
  discoveredUrlCount: number;
  services: ServiceFact[];
  /** Services named on the site that have no dedicated page among those read. */
  servicesWithoutPage: ServiceFact[];
  city: string;
  /** Crawled pages whose title/H1/URL names the city. */
  localPages: string[];
  homeTitle: string;
  homeH1: string;
  homeTitleNamesCity: boolean;
  /** A sentence of the site describing the zone served, when present. */
  zoneQuote: string;
  contact: {
    phone: string;
    homeTelLinks: number;
    phoneInHeader: boolean;
    ctaInFirstScreen: boolean;
    firstScreenText: string;
    homeCtas: string[];
    homeForm: boolean;
    contactPage?: string;
    devisPage?: string;
    /** Largest form found (fields + labels) and where. */
    mainForm?: { path: string; fieldCount: number; fields: string[] };
    formAsksProjectDetails: boolean;
    mailtoOnly: boolean;
  };
  proof: {
    homeProofMarkers: string[];
    firstProofPct: number | null;
    firstCtaPct: number | null;
    avisPage?: string;
    realisationsPage?: string;
    realisationsImages?: number;
    certifications: string[];
    certificationsOnHome: string[];
    certificationPage?: string;
    experienceQuote: string;
    googleReviewsWidget: boolean;
  };
  legal: { page?: string; siret: string };
  socialLinks: Record<string, string>;
};

/** The sentence of the site that contains the match, bounded — quoted verbatim. */
function quoteAround(text: string, re: RegExp, radius = 90): string {
  const m = text.match(re);
  if (!m || m.index === undefined) return "";
  const before = text.slice(0, m.index);
  const sentenceStart = Math.max(before.lastIndexOf(". "), before.lastIndexOf("! "), before.lastIndexOf("? "), before.lastIndexOf(" : "));
  let start = sentenceStart >= 0 ? sentenceStart + 2 : 0;
  if (m.index - start > radius) start = m.index - radius;
  const after = text.slice(m.index + m[0].length);
  const endRel = after.search(/[.!?](?:\s|$)/);
  let end = m.index + m[0].length + (endRel >= 0 ? endRel + 1 : after.length);
  if (end - (m.index + m[0].length) > radius) end = m.index + m[0].length + radius;
  let snippet = text.slice(start, end).trim();
  const cutStart = start > 0 && !/[.!?:]\s*$/.test(text.slice(0, start));
  const cutEnd = end < text.length && !/[.!?]$/.test(snippet);
  if (cutStart) snippet = snippet.replace(/^\S*\s/, "");
  if (cutEnd) snippet = snippet.replace(/\s\S*$/, "");
  if (!cutEnd) snippet = snippet.replace(/\.$/, "");
  return `${cutStart ? "…" : ""}${snippet}${cutEnd ? "…" : ""}`;
}

/** "Couvreur / toiture" → "couvreur"; "Autre — Vitrier" → "vitrier". */
export function tradeWord(trade: string): string {
  return trade.replace(/^autre\s*[—–-]\s*/i, "").split("/")[0].trim().toLowerCase();
}

function pageHead(page: CrawledPage): string {
  return normalize(`${page.title} ${page.h1.join(" ")}`);
}

function pathSlug(path: string): string {
  try {
    return normalize(decodeURIComponent(path)).replace(/[^a-z0-9]+/g, "-");
  } catch {
    return normalize(path).replace(/[^a-z0-9]+/g, "-");
  }
}

function isDedicated(page: CrawledPage, def: ServiceDef): boolean {
  if (page.kind === "home" || page.kind === "legal" || page.kind === "contact") return false;
  return def.slug.test(pathSlug(page.path)) || (page.h1.some((h) => def.re.test(h)) && page.kind !== "blog");
}

export function extractFacts(crawl: SiteCrawl, context: { city?: string } = {}): SiteFacts {
  const pages = crawl.pages;
  const home = pages.find((p) => p.kind === "home") ?? pages[0];
  const domain = (() => {
    try {
      return new URL(crawl.rootUrl).hostname.replace(/^www\./, "");
    } catch {
      return crawl.rootUrl;
    }
  })();
  const navText = (crawl.home?.navLabels ?? []).join(" · ");

  const services: ServiceFact[] = [];
  for (const def of SERVICES) {
    const mentionedOn = pages.filter((p) => p.kind !== "legal" && def.re.test(p.text)).map((p) => p.path);
    const inNav = def.re.test(navText);
    if (mentionedOn.length === 0 && !inNav) continue;
    const dedicated =
      pages.find((p) => isDedicated(p, def))?.path ??
      crawl.knownPaths.find((path) => path !== "/" && def.slug.test(pathSlug(path)) && !/blog|actu|article|conseil|news/.test(path));
    const quoteSource = pages.find((p) => p.kind !== "legal" && def.re.test(p.text));
    services.push({
      label: def.label,
      mentionedOn,
      dedicatedPage: dedicated,
      quote: quoteSource ? quoteAround(quoteSource.text, def.re) : "",
      onHome: inNav || (home ? def.re.test(home.text) : false),
    });
  }

  // Universal fallback: any page the crawler identified as a service/offer page
  // can become an observed offer even when it is outside the historic BTP
  // vocabulary. This keeps the engine useful for restaurants, clinics, SaaS,
  // agencies, hotels, shops, etc. without inventing a taxonomy.
  for (const page of pages.filter((p) => p.kind === "service")) {
    const raw = (page.h1[0] || page.title || "").replace(/\s+/g, " ").trim();
    const label = raw.replace(/\s*[|–—-]\s*[^|–—]{2,80}$/, "").trim();
    const key = normalize(label);
    if (!label || label.length < 3 || label.length > 80 || label.split(/\s+/).length > 10) continue;
    if (/^(?:services?|prestations?|solutions?|expertises?|offres?|produits?|notre offre|nos services)$/i.test(label)) continue;
    if (services.some((svc) => normalize(svc.label) === key)) continue;
    const inNav = normalize(navText).includes(key);
    services.push({
      label,
      mentionedOn: [page.path],
      dedicatedPage: page.path,
      quote: page.h1[0] || "",
      onHome: inNav,
    });
  }
  services.sort((a, b) => b.mentionedOn.length + Number(b.onHome) * 2 - (a.mentionedOn.length + Number(a.onHome) * 2));

  // Services the site sells but gives no page to. When the whole site is a
  // single page, every service is in that case; that is its own finding.
  const servicesWithoutPage = services.filter((s) => !s.dedicatedPage && (s.onHome || s.mentionedOn.length >= 1));

  const city = (context.city ?? "").trim();
  const cityNorm = normalize(city);
  const localPages = cityNorm
    ? pages.filter((p) => p.kind !== "home" && p.kind !== "legal" && p.kind !== "contact" && (pageHead(p).includes(cityNorm) || pathSlug(p.path).includes(cityNorm.replace(/\s+/g, "-")))).map((p) => p.path)
    : [];

  const zoneRe = /(?:zone d.intervention|nous intervenons|intervenons (?:sur|dans|à|en)|secteur d.intervention|dans un rayon de|interviennent (?:sur|dans))/i;
  const zoneSource = pages.find((p) => zoneRe.test(p.text));

  const telLinks = home?.telLinks ?? [];
  const phone = telLinks[0] || home?.phones[0] || pages.find((p) => p.phones.length)?.phones[0] || "";

  const formPages = pages
    .flatMap((p) => p.forms.map((f) => ({ path: p.path, ...f })))
    .sort((a, b) => b.fieldCount - a.fieldCount);
  const mainForm = formPages[0];
  const projectRe = /travaux|projet|prestation|besoin|type|service|surface|d[ée]lai|budget|adresse|ville|code postal|photo|fichier|message/i;

  const contactPage = pages.find((p) => p.kind === "contact")?.path;
  const devisPage = pages.find((p) => p.kind === "devis")?.path;
  const anyMailto = pages.some((p) => /\S+@\S+\.\S+/.test(p.text));

  const realisations = pages.find((p) => p.kind === "realisations");
  const avis = pages.find((p) => p.kind === "avis");
  const certifications = [...new Set(pages.flatMap((p) => p.certifications))];
  const certificationsOnHome = home?.certifications ?? [];
  const certificationPage = pages.find((p) => p.kind !== "home" && p.certifications.length > 0)?.path;
  const experienceSource = pages.find((p) => /depuis (?:19|20)\d{2}|\d{2,3} ans d.exp[ée]rience|plus de \d+ ans/i.test(p.text));

  const legalPage = pages.find((p) => p.kind === "legal");
  const siret = pages.map((p) => p.text.match(/\b(?:siret|siren)\s*:?\s*([\d ]{9,17})/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "").find(Boolean) ?? "";

  return {
    domain,
    pagesAnalyzed: pages.length,
    pagePaths: pages.map((p) => p.path),
    sitemapUrlCount: crawl.sitemapUrlCount,
    discoveredUrlCount: crawl.discoveredUrlCount,
    services: services.slice(0, 12),
    servicesWithoutPage: servicesWithoutPage.slice(0, 6),
    city,
    localPages,
    homeTitle: home?.title ?? "",
    homeH1: home?.h1[0] ?? "",
    homeTitleNamesCity: cityNorm ? normalize(`${home?.title ?? ""} ${home?.h1.join(" ") ?? ""}`).includes(cityNorm) : false,
    zoneQuote: zoneSource ? quoteAround(zoneSource.text, zoneRe, 90) : "",
    contact: {
      phone,
      homeTelLinks: telLinks.length,
      phoneInHeader: crawl.home?.phoneInHeader ?? false,
      ctaInFirstScreen: crawl.home?.ctaInFirstScreen ?? false,
      firstScreenText: crawl.home?.firstScreenText ?? "",
      homeCtas: home?.ctas ?? [],
      homeForm: (home?.forms.length ?? 0) > 0,
      contactPage,
      devisPage,
      mainForm: mainForm ? { path: mainForm.path, fieldCount: mainForm.fieldCount, fields: mainForm.fields } : undefined,
      formAsksProjectDetails: mainForm ? mainForm.fields.some((f) => projectRe.test(f)) : false,
      mailtoOnly: formPages.length === 0 && anyMailto,
    },
    proof: {
      homeProofMarkers: home?.proofMarkers ?? [],
      firstProofPct: crawl.home?.firstProofPct ?? null,
      firstCtaPct: crawl.home?.firstCtaPct ?? null,
      avisPage: avis?.path,
      realisationsPage: realisations?.path,
      realisationsImages: realisations?.imageCount,
      certifications,
      certificationsOnHome,
      certificationPage,
      experienceQuote: experienceSource
        ? quoteAround(experienceSource.text, /depuis (?:19|20)\d{2}|\d{2,3} ans d.exp[ée]rience|plus de \d+ ans/i, 50)
        : "",
      googleReviewsWidget: pages.some((p) => p.proofMarkers.includes("avis Google")),
    },
    legal: { page: legalPage?.path, siret },
    socialLinks: crawl.socialLinks as Record<string, string>,
  };
}

// ---------------------------------------------------------------------------
// Deterministic cards

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function listPaths(paths: string[], max = 2): string {
  const shown = paths.slice(0, max).map((p) => (p === "/" ? "la page d’accueil" : p));
  return shown.join(", ") + (paths.length > max ? `…` : "");
}

function card(partial: Omit<DiagnosticCard, "potential" | "basis"> & { basis?: DiagnosticCard["basis"] }): DiagnosticCard {
  return { ...partial, basis: partial.basis ?? "site", potential: potentialForScore(partial.score) };
}

const RGE_SENSITIVE = /isolation|pompe|photovolta|chaudi|r[ée]novation [ée]nerg|po[êe]le|chauffe-eau|fen[êe]tres/i;

/**
 * Builds every card the facts can support, ranked by commercial weight.
 * Weight ≈ (10 − score) × how directly the point sits on the path to a commercial action.
 */
export function buildEvidenceCards(facts: SiteFacts, context: { trade?: string } = {}): DiagnosticCard[] {
  const cards: DiagnosticCard[] = [];
  const city = facts.city;
  const where = city ? ` ${city}` : "";
  const trade = tradeWord(context.trade ?? "");
  const onePage = facts.pagesAnalyzed <= 1 && (facts.sitemapUrlCount ?? 0) <= 1 && facts.discoveredUrlCount <= 1;

  // ÊTRE TROUVÉ ---------------------------------------------------------------
  if (onePage && facts.services.length >= 2) {
    const names = facts.services.slice(0, 3).map((s) => s.label);
    cards.push(
      card({
        id: "found_single_page",
        axis: "trouve",
        title: "Transformer votre offre en plusieurs portes d’entrée",
        score: 3,
        finding: `Votre site tient sur une seule page alors qu’il présente plusieurs services (${names.join(", ")}). Aucun de ces services n’a sa propre page.`,
        seen: `Aucun lien interne ni sitemap exploitable n’a été retrouvé sur ${facts.domain} : ${names.length} services partagent la même URL.`,
        loss: `Vous avez déjà plusieurs offres à présenter : une page dédiée à « ${names[0]}${where} » peut mieux capter les prospects qui cherchent précisément cette prestation.`,
        potentialText: "Chaque offre peut devenir une porte d’entrée distincte vers une action commerciale, au lieu de dépendre d’une seule page généraliste.",
        fix: `Créer d’abord une page « ${cap(names[0])}${where} » avec preuves concrètes et une action principale claire.`,
        weight: 9,
      })
    );
  } else {
    const missing = facts.servicesWithoutPage.filter((s) => !trade || !normalize(trade).includes(normalize(s.label).split(" ")[0]));
    const target = missing[0];
    const withPage = facts.services.filter((s) => s.dedicatedPage);
    if (target && facts.pagesAnalyzed >= 2) {
      const score = withPage.length === 0 ? 3 : missing.length >= 3 ? 4 : 5;
      cards.push(
        card({
          id: "found_service_without_page",
          axis: "trouve",
          title: `Faire de « ${target.label} » une porte d’entrée commerciale`,
          score,
          finding: `« ${cap(target.label)} » apparaît dans le contenu de votre site${target.mentionedOn.length ? ` (${listPaths(target.mentionedOn)})` : ""}, mais aucune page dédiée à ce service n’a été retrouvée parmi les ${Math.max(facts.pagesAnalyzed, facts.discoveredUrlCount)} pages ${facts.sitemapUrlCount ? "listées par votre site" : "retrouvées"}.`,
          seen: target.quote ? `« ${target.quote.replace(/^…|…$/g, "").trim()} » — sans page propre à ce service.` : `Le service est cité mais aucune URL, titre ou H1 ne lui est consacré.`,
          loss: `Le service existe déjà chez vous : une page dédiée peut vous rendre beaucoup plus lisible pour les prospects qui cherchent exactement « ${target.label}${where} ».`,
          potentialText: "Vous partez d’une offre déjà existante : il suffit de lui donner sa propre porte d’entrée pour mieux capter une demande déjà qualifiée.",
          fix: `Créer une page « ${cap(target.label)}${where} » : proposition claire, preuves adaptées et action principale visible.`,
          weight: 8 + Math.min(2, target.mentionedOn.length),
        })
      );
    }
  }

  if (city && facts.localPages.length === 0 && !facts.homeTitleNamesCity && facts.homeTitle) {
    cards.push(
      card({
        id: "found_city_absent",
        axis: "trouve",
        title: `Faire de ${city} un vrai point d’entrée local`,
        score: facts.zoneQuote ? 5 : 4,
        finding: `Le titre de votre page d’accueil (« ${facts.homeTitle.slice(0, 80)} ») ne cite pas ${city}, et aucune page consacrée à votre zone n’a été retrouvée.`,
        seen: facts.zoneQuote
          ? `Votre zone n’est évoquée que dans le texte : « ${facts.zoneQuote.replace(/^…|…$/g, "").trim().slice(0, 150)} ».`
          : `Aucune mention claire de votre zone d’intervention n’a été retrouvée sur les ${facts.pagesAnalyzed} pages lues.`,
        loss: `Votre implantation existe déjà : la rendre plus visible peut aider les prospects locaux à comprendre immédiatement où vous êtes et comment vous solliciter.`,
        potentialText: "Une présence locale plus explicite rassure immédiatement le prospect et rapproche la recherche de la prise de contact.",
        fix: `Ajouter ${city} dans le titre et le haut de la page d’accueil, puis créer une page locale dédiée si l’activité dépend réellement d’une zone.`,
        weight: 7,
      })
    );
  }

  // ÊTRE CHOISI ---------------------------------------------------------------
  const p = facts.proof;
  if (p.realisationsPage && !p.homeProofMarkers.length && (p.realisationsImages ?? 0) >= 3) {
    cards.push(
      card({
        id: "chosen_realisations_hidden",
        axis: "choisi",
        title: "Mettre vos preuves visuelles au cœur de la décision",
        score: 5,
        finding: `Vous avez une page de projets/galerie (${p.realisationsPage}, ${p.realisationsImages} images), mais la page d’accueil ne montre ni avis ni témoignage près de l’action principale.`,
        seen: `${p.realisationsPage} contient ${p.realisationsImages} visuels ; la page d’accueil ne contient aucun marqueur d’avis ou de témoignage.`,
        loss: "Vous avez déjà la matière pour rassurer : vos preuves visuelles peuvent peser davantage dans la décision si elles apparaissent juste avant l’action principale.",
        potentialText: "Rapprocher vos preuves réelles de l’action principale rend votre sérieux visible au moment où le prospect décide.",
        fix: `Afficher 3 preuves visuelles issues de ${p.realisationsPage} directement au-dessus de l’action principale de l’accueil.`,
        weight: 7,
      })
    );
  } else if (!p.realisationsPage && facts.pagesAnalyzed >= 2 && !p.homeProofMarkers.length && !p.avisPage) {
    cards.push(
      card({
        id: "chosen_no_proof",
        axis: "choisi",
        title: "Transformer vos références en preuves qui rassurent",
        score: 3,
        finding: `Sur les ${facts.pagesAnalyzed} pages explorées, aucune page de références/galerie ni d’avis clients n’a été retrouvée, et l’accueil ne montre aucun témoignage.`,
        seen: `Pages lues : ${listPaths(facts.pagePaths, 5)} — aucune ne présente de références visuelles ou d’avis.`,
        loss: "Des preuves concrètes peuvent aider un prospect qui ne vous connaît pas encore à se projeter plus vite et à choisir votre entreprise avec davantage de confiance.",
        potentialText: "Des preuves réelles visibles rassurent les prospects qui ne vous connaissent pas encore.",
        fix: "Publier une page de références, cas, galerie ou réalisations avec des preuves réelles et la relier depuis l’accueil.",
        weight: 8,
      })
    );
  } else if (p.firstProofPct !== null && p.firstCtaPct !== null && p.firstProofPct - p.firstCtaPct >= 45) {
    cards.push(
      card({
        id: "chosen_proof_far_from_cta",
        axis: "choisi",
        title: "Rapprocher vos avis de l’action principale",
        score: 6,
        finding: `Sur la page d’accueil, la première action commerciale arrive vers ${p.firstCtaPct} % de la page, mais les premiers avis seulement vers ${p.firstProofPct} %.`,
        seen: `Ordre observé sur la page d’accueil : action principale (≈${p.firstCtaPct} %) → avis/témoignages (≈${p.firstProofPct} %).`,
        loss: "Vos avis peuvent jouer leur rôle plus tôt : les rapprocher du premier appel à l’action peut rassurer au moment exact où le prospect hésite encore.",
        potentialText: "Placer une preuve à côté du premier bouton peut lever l’hésitation au bon moment.",
        fix: "Remonter 2 avis clients vérifiables juste sous la première action principale.",
        weight: 5,
      })
    );
  }

  const rgeRelevant = facts.services.some((s) => RGE_SENSITIVE.test(s.label));
  if (p.certifications.length > 0 && p.certificationsOnHome.length === 0 && p.certificationPage) {
    cards.push(
      card({
        id: "chosen_labels_hidden",
        axis: "choisi",
        title: `Mettre votre ${p.certifications[0]} au service du choix`,
        score: 5,
        finding: `${p.certifications.slice(0, 2).join(" et ")} ${p.certifications.length > 1 ? "sont mentionnés" : "est mentionné"} sur ${p.certificationPage}, mais pas sur la page d’accueil.`,
        seen: `Présent sur ${p.certificationPage} ; absent de la page d’accueil.`,
        loss: rgeRelevant
          ? "Un prospect qui vise une aide (MaPrimeRénov’, CEE) peut vous écarter faute de voir le label au premier coup d’œil."
          : "Un gage de sérieux que vous avez déjà n’aide pas le prospect à vous choisir s’il ne le voit pas.",
        potentialText: "Afficher un label déjà obtenu rassure immédiatement, sans rien produire de nouveau.",
        fix: `Afficher le logo ${p.certifications[0]} dans le haut de l’accueil et à côté du formulaire de devis.`,
        weight: rgeRelevant ? 7 : 5,
      })
    );
  } else if (rgeRelevant && p.certifications.length === 0 && facts.pagesAnalyzed >= 2) {
    const svc = facts.services.find((s) => RGE_SENSITIVE.test(s.label))!;
    cards.push(
      card({
        id: "chosen_rge_unclear",
        axis: "choisi",
        title: "Rendre vos qualifications visibles au bon moment",
        score: 4,
        finding: `Vous proposez « ${svc.label} », mais aucune mention RGE, Qualibat ou garantie décennale n’a été retrouvée sur les ${facts.pagesAnalyzed} pages lues (à confirmer si vous les détenez).`,
        seen: `« ${svc.quote.replace(/^…|…$/g, "").trim().slice(0, 140) || svc.label} » — sans label ni assurance affichés.`,
        loss: "Les particuliers qui comptent sur MaPrimeRénov’ ou les CEE cherchent souvent un artisan RGE avant même de demander un devis.",
        potentialText: "Afficher vos qualifications réelles rassure sur l’éligibilité aux aides et sur votre sérieux.",
        fix: "Afficher vos qualifications et votre assurance décennale (logo + numéro) sur la page du service et près du devis.",
        weight: 6,
      })
    );
  }

  // ÊTRE CONTACTÉ -------------------------------------------------------------
  const c = facts.contact;
  if (c.phone && c.homeTelLinks === 0) {
    cards.push(
      card({
        id: "contact_no_click_to_call",
        axis: "contacte",
        title: "Transformer votre numéro en accès direct",
        score: 4,
        finding: `Le numéro ${c.phone} est écrit sur votre site, mais aucun lien d’appel direct (tel:) n’a été détecté sur la page d’accueil.`,
        seen: `${c.phone} présent en texte ; 0 lien « tel: » sur la page d’accueil.`,
        loss: "Votre numéro est déjà présent : le rendre cliquable transforme une simple information en accès direct pour les prospects prêts à appeler.",
        potentialText: "Un appel en un geste capte les prospects pressés, souvent les plus prêts à faire les travaux.",
        fix: `Rendre ${c.phone} cliquable dans l’en-tête et ajouter un bouton « Appeler » fixe en bas d’écran sur mobile.`,
        weight: 8,
      })
    );
  } else if (!c.phone && facts.pagesAnalyzed >= 1) {
    cards.push(
      card({
        id: "contact_no_phone",
        axis: "contacte",
        title: "Créer un accès direct pour les prospects prêts à agir",
        score: 3,
        finding: `Aucun numéro de téléphone n’a été retrouvé sur les ${facts.pagesAnalyzed} pages explorées de ${facts.domain}.`,
        seen: `0 lien « tel: » et 0 numéro écrit sur : ${listPaths(facts.pagePaths, 4)}.`,
        loss: "Un numéro visible et cliquable peut transformer plus facilement un intérêt fort en appel direct.",
        potentialText: "Afficher un numéro direct réduit l’effort pour les prospects prêts à prendre contact.",
        fix: "Afficher un numéro cliquable dans l’en-tête de toutes les pages.",
        weight: 9,
      })
    );
  } else if (!c.phoneInHeader && !c.ctaInFirstScreen) {
    cards.push(
      card({
        id: "contact_not_first_screen",
        axis: "contacte",
        title: "Mettre l’action au premier écran",
        score: 4,
        finding: `Le haut de votre page d’accueil ne montre ni numéro ni action commerciale claire${c.firstScreenText ? ` : on y lit « ${c.firstScreenText.slice(0, 90).trim()}… »` : ""}.`,
        seen: `Premier écran sans action commerciale claire ni numéro ; le premier appel à l’action arrive vers ${facts.proof.firstCtaPct ?? "?"} % de la page.`,
        loss: "Vous pouvez raccourcir le chemin entre l’intérêt et la prise de contact en donnant immédiatement une action claire au prospect décidé.",
        potentialText: "Une action visible dès l’arrivée transforme plus facilement l’intérêt en demande.",
        fix: `Ajouter en haut de l’accueil une action principale explicite et le numéro ${c.phone || ""} cliquable.`.replace(/\s+cliquable/, " cliquable"),
        weight: 7,
      })
    );
  }

  if (c.mainForm && c.mainForm.fieldCount >= 9) {
    cards.push(
      card({
        id: "contact_long_form",
        axis: "contacte",
        title: "Raccourcir le chemin jusqu’à la conversion",
        score: 5,
        finding: `Le formulaire de ${c.mainForm.path === "/" ? "la page d’accueil" : c.mainForm.path} demande ${c.mainForm.fieldCount} champs avant de pouvoir envoyer une demande.`,
        seen: `Champs demandés : ${c.mainForm.fields.slice(0, 7).join(", ")}${c.mainForm.fields.length > 7 ? "…" : "."}`,
        loss: "Votre formulaire peut conserver la qualification tout en demandant moins d’effort au prospect au premier contact.",
        potentialText: "Un formulaire court en deux étapes garde la qualification sans décourager.",
        fix: "Réduire à 4 champs essentiels (nom, contact, besoin, contexte) puis demander le reste après le premier échange.",
        weight: 6,
      })
    );
  } else if (c.mainForm && !c.formAsksProjectDetails && c.mainForm.fieldCount <= 4) {
    cards.push(
      card({
        id: "contact_form_unqualified",
        axis: "contacte",
        title: "Mieux qualifier les demandes dès le départ",
        score: 6,
        finding: `Le formulaire (${c.mainForm.path === "/" ? "accueil" : c.mainForm.path}) ne demande pas clairement le besoin ou le contexte : ${c.mainForm.fields.join(", ")}.`,
        seen: `${c.mainForm.fieldCount} champs : ${c.mainForm.fields.join(", ")}.`,
        loss: "Deux informations simples peuvent vous aider à repérer plus vite les demandes réellement adaptées à votre offre.",
        potentialText: "Deux questions simples permettent de traiter en priorité les demandes vraiment intéressantes.",
        fix: "Ajouter deux champs courts : « Votre besoin » et « Contexte / objectif ».",
        weight: 4,
      })
    );
  } else if (!c.mainForm && c.mailtoOnly && facts.pagesAnalyzed >= 2) {
    cards.push(
      card({
        id: "contact_no_form",
        axis: "contacte",
        title: "Ouvrir une deuxième porte vers la prise de contact",
        score: 4,
        finding: `Aucun formulaire n’a été retrouvé sur les ${facts.pagesAnalyzed} pages lues${c.contactPage ? ` (y compris ${c.contactPage})` : ""} : la seule option écrite est l’e-mail.`,
        seen: `0 formulaire détecté sur : ${listPaths(facts.pagePaths, 4)}.`,
        loss: "Un formulaire court peut capter les prospects qui préfèrent écrire plutôt qu’appeler, notamment en dehors des horaires de travail.",
        potentialText: "Un formulaire court capte les demandes des prospects qui préfèrent écrire, souvent le soir ou le week-end.",
        fix: "Ajouter un formulaire de 4 champs (nom, téléphone, ville, type de travaux) sur l’accueil et la page contact.",
        weight: 6,
      })
    );
  }

  return cards.sort((a, b) => (10 - b.score) * (b.weight ?? 5) - (10 - a.score) * (a.weight ?? 5));
}

/**
 * Picks the three highest-impact cards, preferring distinct axes only when
 * the next-best card on another axis is close in impact — the goal is the
 * three biggest problems, not three filled boxes.
 */
export function pickTopCards(cards: DiagnosticCard[], max = 3): DiagnosticCard[] {
  const impact = (c: DiagnosticCard) => (10 - c.score) * (c.weight ?? 5);
  const remaining = [...cards].sort((a, b) => impact(b) - impact(a));
  const picked: DiagnosticCard[] = [];
  while (picked.length < max && remaining.length > 0) {
    const best = remaining[0];
    const axesUsed = new Set(picked.map((c) => c.axis));
    const diverse = remaining.find((c) => !axesUsed.has(c.axis));
    const choice = axesUsed.has(best.axis) && diverse && impact(diverse) >= impact(best) * 0.7 ? diverse : best;
    picked.push(choice);
    remaining.splice(remaining.indexOf(choice), 1);
  }
  return picked;
}

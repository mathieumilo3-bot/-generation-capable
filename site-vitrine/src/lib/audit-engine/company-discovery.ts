import { htmlToText, normalize, normalizePhone } from "./crawl";
import { callResponses, pollBackgroundResponse, startBackgroundResponse } from "./openai";
import { fetchPublicHtml, type FetchHtmlResult } from "./probe";
import type { AiAuditWebSource } from "./types";

const DEFAULT_MODEL = "gpt-5.6-sol";
const FAST_DISCOVERY_MODEL = "gpt-5.6-luna";
const OPENAI_TIMEOUT_MS = 32_000;

type FetchLike = typeof fetch;

export type CompanyDiscoveryInsight = {
  title: string;
  insight: string;
  evidence: string[];
};

export type CompanyDiscoveryCandidate = {
  name: string;
  website: string;
  /** Set after the site itself was read: what on it matches the company. */
  verification?: { verified: boolean; evidence: string[] };
  sector: string;
  city: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  /** Legacy field: kept so a stored older session still parses. */
  insights?: CompanyDiscoveryInsight[];
};

export type CompanyDiscoveryResult = {
  candidates: CompanyDiscoveryCandidate[];
  webSources: AiAuditWebSource[];
};

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["candidates"],
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "website", "sector", "city", "summary", "confidence"],
          properties: {
            name: { type: "string" },
            website: { type: "string" },
            sector: { type: "string" },
            city: { type: "string" },
            summary: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
      },
    },
  };
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Directories, marketplaces and social networks: sources, never the official site. */
const NON_OFFICIAL_HOSTS = [
  "pagesjaunes.fr",
  "pappers.fr",
  "societe.com",
  "verif.com",
  "infogreffe.fr",
  "annuaire-entreprises.data.gouv.fr",
  "manageo.fr",
  "corporama.com",
  "entreprises.lefigaro.fr",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
  "x.com",
  "twitter.com",
  "google.com",
  "google.fr",
  "maps.google.com",
  "g.page",
  "goo.gl",
  "houzz.fr",
  "houzz.com",
  "habitatpresto.com",
  "travaux.com",
  "allovoisins.com",
  "starofservice.com",
  "quotatis.fr",
  "trustlocal.fr",
  "hellopro.fr",
  "yelp.fr",
  "yelp.com",
  "cylex-france.fr",
  "118712.fr",
  "annuaire.118000.fr",
  "mappy.com",
  "justacote.com",
  "leboncoin.fr",
  "wikipedia.org",
];

export function isNonOfficialHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return NON_OFFICIAL_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function normalizeWebsite(value: unknown): string {
  const raw = clean(value, 300);
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (isNonOfficialHost(url.hostname)) return "";
    return `${url.protocol}//${url.host}/`;
  } catch {
    return "";
  }
}

function sanitizeCandidate(value: unknown): CompanyDiscoveryCandidate | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = clean(raw.name, 160);
  if (!name) return null;
  const confidence = ["high", "medium", "low"].includes(String(raw.confidence))
    ? (raw.confidence as CompanyDiscoveryCandidate["confidence"])
    : "low";

  const insights = Array.isArray(raw.insights)
    ? raw.insights
        .map((value) => {
          if (!value || typeof value !== "object") return null;
          const item = value as Record<string, unknown>;
          const title = clean(item.title, 180);
          const insight = clean(item.insight, 620);
          if (!title || !insight) return null;
          return {
            title,
            insight,
            evidence: Array.isArray(item.evidence)
              ? item.evidence.map((entry) => clean(entry, 240)).filter(Boolean).slice(0, 3)
              : [],
          };
        })
        .filter(Boolean)
        .slice(0, 3) as CompanyDiscoveryInsight[]
    : [];

  return {
    name,
    website: normalizeWebsite(raw.website),
    sector: clean(raw.sector, 100),
    city: clean(raw.city, 120),
    summary: clean(raw.summary, 420),
    confidence,
    ...(insights.length ? { insights } : {}),
  };
}


function normalizedTokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !["sarl", "sas", "eurl", "entreprise", "societe"].includes(token));
}

function candidateFromSources(query: string, sources: AiAuditWebSource[]): CompanyDiscoveryCandidate | null {
  const tokens = normalizedTokens(query);
  if (!tokens.length) return null;

  for (const source of sources) {
    let haystack = source.title.toLowerCase();
    try {
      haystack += " " + new URL(source.url).hostname.toLowerCase();
    } catch {}
    const normalized = normalizedTokens(haystack).join(" ");
    const matched = tokens.filter((token) => normalized.includes(token));
    if (matched.length < Math.min(2, tokens.length)) continue;

    let website = "";
    try {
      const url = new URL(source.url);
      if (!isNonOfficialHost(url.hostname)) website = `${url.protocol}//${url.host}/`;
    } catch {}

    return {
      name: query,
      website,
      sector: "",
      city: "",
      summary: `Une présence web correspondant fortement à « ${query} » a été retrouvée et sera recoupée pendant l'analyse.`,
      confidence: "medium",
    };
  }

  return null;
}

function discoveryPrompt(query: string, cityHint: string, rescue: boolean, identityHint = ""): string {
  return `Retrouve l'entreprise correspondant au nom suivant : "${query}".${cityHint ? ` La ville ou le code postal de référence est : "${cityHint}". Utilise-le comme contrainte forte d'identification.` : ""}${identityHint ? ` Le registre public français a déjà identifié cette entité : "${identityHint}". Utilise surtout le SIREN, la raison sociale et le siège comme ancres pour retrouver très vite son site officiel ; ne recommence pas une recherche générale d'homonymes sauf contradiction.` : ""}

MISSION
Tu dois faire comme un consultant humain qui cherche vraiment cette société sur le web avant un audit commercial.

METHODE OBLIGATOIRE
1. Recherche le nom exact entre guillemets, puis le nom + ville/code postal si une ville est fournie.
2. Recherche ensuite plusieurs variantes : nom + entreprise, nom + métier probable, nom + bâtiment/BTP/artisan, puis nom + ville + métier.
3. Cherche explicitement le SITE OFFICIEL : nom + "site officiel", nom + domaine, puis recoupe le domaine trouvé avec les mentions légales, le nom, l'adresse, le téléphone, la ville ou les réseaux sociaux.
4. Si le nom saisi est un sigle, une raison sociale ou un ancien nom, IDENTIFIE D'ABORD les passerelles d'identité publiques : enseigne/marque commerciale, dirigeant, adresse, code postal, téléphone, SIREN/SIRET/RCS. Recherche ensuite ces identifiants exacts entre guillemets pour retrouver le domaine utilisé publiquement. Exemple de cas à traiter : une SARL appelée "AATP" peut communiquer sous une enseigne totalement différente sur son site.
5. Utilise les annuaires, Google Business, PagesJaunes, Pappers/Societe, annuaire-entreprises.data.gouv.fr, Facebook, Instagram ou LinkedIn comme SOURCES DE RECOUPEMENT, jamais comme website officiel.
6. Si un domaine semble officiel, vérifie au moins deux signaux convergents parmi : raison sociale ou enseigne, ville/adresse, téléphone, métier, SIREN/SIRET/RCS, mentions légales, lien depuis un profil officiel, branding cohérent. Une différence entre raison sociale et marque du site n'est PAS un motif de rejet si les identifiants légaux ou de contact concordent.
7. Le trafic vient de France : privilégie d'abord les entreprises françaises quand le nom n'indique pas un autre pays.
8. Si plusieurs entreprises portent le même nom, garde plusieurs candidats et baisse confidence. La ville fournie doit départager fortement.
9. Une entreprise peut être identifiée sans site officiel : dans ce cas website reste vide. N'invente jamais un domaine.
10. N'abandonne pas parce qu'un site refuse un accès technique : continue à chercher son domaine via les autres sources publiques.
11. Avant de conclure qu'aucun site n'existe, essaie AU MINIMUM les variantes suivantes quand les données existent : raison sociale + ville, enseigne + ville, téléphone exact, SIREN/SIRET exact, adresse + métier, dirigeant + métier + ville, puis domaine/mentions légales.

CRITERES DE L'AUDIT GC
- ATTIRER : présence sur des recherches métier/service/zone sans connaître la marque.
- RASSURER : clarté de l'offre, réalisations, avis, garanties, photos, références, cohérence de la présence publique.
- CONVERTIR : facilité pour appeler, demander un devis ou comprendre la prochaine action.
- Retenir seulement 1 à 3 opportunités réellement utiles commercialement.
- Toujours relier chaque constat à une preuve publique précise.
- Jamais de classement Google inventé, de trafic estimé, de taux de conversion ou de chiffre non vérifié.

SORTIE
- name : nom le plus probable.
- website : uniquement le site officiel vérifié, sinon chaîne vide.
- sector : métier réel ; utilise si possible Couvreur / toiture, Plombier / chauffagiste, Électricien, Menuisier, Peintre / façadier, Maçon, Paysagiste, Entreprise générale BTP ; sinon Autre — <métier>.
- city : ville/zone la plus solide, sinon chaîne vide.
- summary : activité + zone + élément qui permet l'identification.
- confidence :
  high = plusieurs signaux convergent ;
  medium = correspondance très probable mais un élément manque ;
  low = vraie ambiguïté.

${rescue ? "C'est une tentative de récupération : la première recherche n'a pas donné de candidat exploitable. Élargis les variantes du nom, les annuaires et les réseaux sociaux avant de conclure qu'il n'y a rien." : ""}

Renvoie uniquement le JSON demandé.`;
}

function discoveryCall(query: string, options: { cityHint?: string; identityHint?: string; rescue?: boolean; timeoutMs: number; fetchFn?: FetchLike; apiKey?: string; model?: string }) {
  return {
    system:
      "Tu es l'analyste GC chargé d'identifier une entreprise réelle à partir de sources web publiques. Tu dois chercher activement, recouper plusieurs sources et ne jamais inventer.",
    user: discoveryPrompt(query, options.cityHint ?? "", Boolean(options.rescue), options.identityHint ?? ""),
    schemaName: "gc_company_discovery_v3",
    schema: schema(),
    webSearch: true,
    // Company identification only needs short result snippets and identity
    // signals. Keep this lean; the full diagnostic later still uses high-context search.
    searchContextSize: (options.rescue ? "medium" : "low") as "medium" | "low",
    searchCity: options.cityHint,
    effort: (options.rescue ? "medium" : "low") as "medium" | "low",
    maxOutputTokens: 1_200,
    timeoutMs: options.timeoutMs,
    fetchFn: options.fetchFn,
    apiKey: options.apiKey,
    model: options.model,
  };
}

function toDiscoveryResult(data: { candidates?: unknown[] }, webSources: AiAuditWebSource[]): CompanyDiscoveryResult {
  const candidates = Array.isArray(data.candidates)
    ? (data.candidates.map(sanitizeCandidate).filter(Boolean).slice(0, 3) as CompanyDiscoveryCandidate[])
    : [];
  return { candidates, webSources };
}

/**
 * Starts company identification as a background job and returns its id.
 * Nothing waits here: the caller polls, so this request stays short enough
 * for any host limit.
 */
export async function startCompanyDiscovery(
  companyName: string,
  options: { cityHint?: string; identityHint?: string; rescue?: boolean; fetchFn?: FetchLike; apiKey?: string; model?: string } = {}
): Promise<string | null> {
  const query = companyName.trim().slice(0, 160);
  if (query.length < 2) return null;
  const model =
    options.model ??
    process.env.OPENAI_DISCOVERY_MODEL ??
    (options.rescue ? process.env.OPENAI_AUDIT_MODEL ?? DEFAULT_MODEL : FAST_DISCOVERY_MODEL);
  return startBackgroundResponse(discoveryCall(query, { ...options, model, timeoutMs: 5_000 }));
}

export type DiscoveryOutcome =
  | { status: "pending" }
  | { status: "done"; result: CompanyDiscoveryResult }
  | { status: "failed"; reason: string };

/**
 * Reads the discovery job once and, when it lands, checks each proposed
 * domain against the site itself before handing anything back.
 */
export async function collectCompanyDiscovery(
  jobId: string,
  companyName: string,
  options: {
    cityHint?: string;
    fetchFn?: FetchLike;
    apiKey?: string;
    verify?: (candidate: CompanyDiscoveryCandidate, opts: { cityHint?: string }) => Promise<CompanyDiscoveryCandidate>;
  } = {}
): Promise<DiscoveryOutcome> {
  const outcome = await pollBackgroundResponse<{ candidates?: unknown[] }>(jobId, { ...options, timeoutMs: 4_000 });
  if (outcome.status === "pending") return { status: "pending" };
  if (outcome.status === "failed") return { status: "failed", reason: outcome.reason };

  const raw = toDiscoveryResult(outcome.result.data, outcome.result.webSources);
  const fallback = raw.candidates.length === 0 ? candidateFromSources(companyName.trim().slice(0, 160), raw.webSources) : null;
  const candidates = fallback ? [fallback] : raw.candidates;
  return { status: "done", result: await verifyCandidates(candidates, raw.webSources, options) };
}

async function runDiscoveryAttempt(
  query: string,
  options: {
    fetchFn?: FetchLike;
    apiKey?: string;
    model?: string;
    rescue?: boolean;
    timeoutMs?: number;
    cityHint?: string;
    identityHint?: string;
  }
): Promise<CompanyDiscoveryResult> {
  const result = await callResponses<{ candidates?: unknown[] }>(
    discoveryCall(query, { ...options, timeoutMs: options.timeoutMs ?? OPENAI_TIMEOUT_MS })
  );
  if (!result) return { candidates: [], webSources: [] };
  return toDiscoveryResult(result.data, result.webSources);
}

async function discoverCompanyUnverified(
  companyName: string,
  options: {
    fetchFn?: FetchLike;
    apiKey?: string;
    model?: string;
    firstTimeoutMs?: number;
    skipRescue?: boolean;
    cityHint?: string;
    identityHint?: string;
  } = {}
): Promise<CompanyDiscoveryResult> {
  const query = companyName.trim().slice(0, 160);
  const cityHint = options.cityHint?.trim().slice(0, 120) || "";
  if (query.length < 2) return { candidates: [], webSources: [] };

  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.OPEN_API_KEY;
  if (!apiKey) return { candidates: [], webSources: [] };

  const fastModel = options.model ?? process.env.OPENAI_DISCOVERY_MODEL ?? FAST_DISCOVERY_MODEL;
  const rescueModel = options.model ?? process.env.OPENAI_AUDIT_MODEL ?? DEFAULT_MODEL;
  const fetchFn = options.fetchFn ?? fetch;

  const first = await runDiscoveryAttempt(query, {
    fetchFn,
    apiKey,
    model: fastModel,
    timeoutMs: options.firstTimeoutMs ?? 18_000,
    cityHint,
    identityHint: options.identityHint,
  });

  const strongFirst = first.candidates.find((candidate) => candidate.confidence === "high" && candidate.website);
  if (strongFirst) {
    return {
      candidates: [strongFirst, ...first.candidates.filter((candidate) => candidate !== strongFirst)].slice(0, 3),
      webSources: first.webSources,
    };
  }

  const sourceCandidate = candidateFromSources(query, first.webSources);
  if (sourceCandidate) {
    return { candidates: [sourceCandidate], webSources: first.webSources };
  }

  if (options.skipRescue) return first;

  const rescue = await runDiscoveryAttempt(query, {
    fetchFn,
    apiKey,
    model: rescueModel,
    rescue: true,
    timeoutMs: 14_000,
    cityHint,
    identityHint: options.identityHint,
  });

  const combinedSources = [...first.webSources, ...rescue.webSources].filter(
    (source, index, all) => all.findIndex((item) => item.url === source.url) === index
  ).slice(0, 10);

  const combinedCandidates = [...first.candidates, ...rescue.candidates]
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (item) =>
            item.name.toLowerCase() === candidate.name.toLowerCase() &&
            item.city.toLowerCase() === candidate.city.toLowerCase() &&
            item.website === candidate.website
        ) === index
    )
    .sort((a, b) => {
      const confidenceWeight = { high: 3, medium: 2, low: 1 } as const;
      const aScore = confidenceWeight[a.confidence] + (a.website ? 3 : 0) + (a.city ? 1 : 0);
      const bScore = confidenceWeight[b.confidence] + (b.website ? 3 : 0) + (b.city ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 3);

  if (combinedCandidates.length > 0) {
    return { candidates: combinedCandidates, webSources: combinedSources };
  }

  const fallback = candidateFromSources(query, combinedSources);
  return {
    candidates: fallback ? [fallback] : [],
    webSources: combinedSources,
  };
}

// ---------------------------------------------------------------------------
// Deterministic check of the official domain

const LEGAL_FORMS = new Set(["sarl", "sas", "sasu", "eurl", "sa", "sci", "ei", "eirl", "entreprise", "societe", "ets", "etablissements", "et", "fils", "les", "des", "de", "du", "la", "le"]);

function brandTokens(name: string): string[] {
  return normalize(name)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length >= 3 && !LEGAL_FORMS.has(t));
}

/**
 * Reads the candidate's homepage (and its legal notice when linked) and
 * checks that the company is really there: name in the domain, title or
 * text, plus the city or the phone when known. A domain the AI proposed but
 * that does not carry the company's name is not accepted as official.
 */
export async function verifyOfficialSite(
  candidate: CompanyDiscoveryCandidate,
  options: { cityHint?: string; fetchPage?: (url: string) => Promise<FetchHtmlResult> } = {}
): Promise<CompanyDiscoveryCandidate> {
  if (!candidate.website) return candidate;
  const fetchPage = options.fetchPage ?? ((url: string) => fetchPublicHtml(url, { timeoutMs: 3_000 }));
  const home = await fetchPage(candidate.website);
  if (!home.ok) {
    return {
      ...candidate,
      confidence: candidate.confidence === "high" ? "medium" : candidate.confidence,
      verification: { verified: false, evidence: ["site officiel non joignable pendant la vérification"] },
    };
  }

  let html = home.html;
  const legalHref = html.match(/<a\b[^>]*href=["']([^"']*mentions?[-_]?l[ée]gales?[^"']*)["']/i)?.[1];
  if (legalHref) {
    try {
      const legalUrl = new URL(legalHref, home.finalUrl);
      if (legalUrl.hostname === home.finalUrl.hostname) {
        const legal = await fetchPage(legalUrl.toString());
        if (legal.ok) html += " " + legal.html;
      }
    } catch {}
  }

  const text = normalize(htmlToText(html));
  // Legal names and acronyms are often written with spaces or punctuation
  // in legal notices ("A A T P" vs "AATP"). Keep a compact representation
  // so a verified legal identity is not discarded just because of typography.
  const compactText = text.replace(/[^a-z0-9]/g, "");
  const host = normalize(home.finalUrl.hostname.replace(/^www\./, "")).replace(/[^a-z0-9]/g, "");
  const tokens = brandTokens(candidate.name);
  const inText = tokens.filter((t) => text.includes(t) || compactText.includes(t));
  const inHost = tokens.filter((t) => host.includes(t));
  const needed = Math.min(2, tokens.length);
  const nameMatch = tokens.length > 0 && (inText.length >= needed || inHost.length >= needed || (inHost.length >= 1 && inText.length >= 1));

  const evidence: string[] = [];
  if (nameMatch) evidence.push(`nom retrouvé sur le site (${[...new Set([...inHost, ...inText])].join(", ")})`);
  const city = (options.cityHint || candidate.city || "").trim();
  const cityMatch = city.length >= 2 && (text.includes(normalize(city)) || (/^\d{5}$/.test(city) && text.includes(city)));
  if (cityMatch) evidence.push(`ville retrouvée (${city})`);
  const phones = [...new Set((htmlToText(html).match(/(?:(?:\+|00)33[\s.-]?|\b0)[1-9](?:[\s.-]?\d{2}){4}/g) ?? []).map(normalizePhone).filter(Boolean))];
  if (phones.length) evidence.push(`téléphone affiché (${phones[0]})`);
  if (/siret|siren|rcs/i.test(text)) evidence.push("mentions légales avec identifiant d’entreprise");

  if (!nameMatch) {
    return {
      ...candidate,
      website: "",
      confidence: "low",
      verification: { verified: false, evidence: [`le nom « ${candidate.name} » n’apparaît pas sur ${home.finalUrl.hostname}`] },
    };
  }

  // Name verified on the site. The city then decides between high and medium.
  let confidence = candidate.confidence === "low" ? "medium" : candidate.confidence;
  if (city && !cityMatch) confidence = "medium";
  else if (cityMatch) confidence = "high";

  return {
    ...candidate,
    website: `${home.finalUrl.protocol}//${home.finalUrl.host}/`,
    confidence,
    verification: { verified: true, evidence },
  };
}

/** Checking a domain means fetching it, so the whole step is capped. */
const VERIFICATION_DEADLINE_MS = 4_500;

async function verifyCandidates(
  candidates: CompanyDiscoveryCandidate[],
  webSources: AiAuditWebSource[],
  options: {
    cityHint?: string;
    verify?: (candidate: CompanyDiscoveryCandidate, opts: { cityHint?: string }) => Promise<CompanyDiscoveryCandidate>;
    deadlineMs?: number;
  }
): Promise<CompanyDiscoveryResult> {
  const verify = options.verify ?? verifyOfficialSite;
  const verified = await Promise.race([
    Promise.all(
      candidates.map((candidate, index) => (index < 2 && candidate.website ? verify(candidate, { cityHint: options.cityHint }) : candidate))
    ),
    // Out of time: hand back what the search found rather than nothing.
    new Promise<CompanyDiscoveryCandidate[]>((resolve) =>
      setTimeout(() => resolve(candidates), options.deadlineMs ?? VERIFICATION_DEADLINE_MS)
    ),
  ]);
  const rank = (c: CompanyDiscoveryCandidate) =>
    ({ high: 3, medium: 2, low: 1 })[c.confidence] + (c.verification?.verified ? 3 : 0) + (c.website ? 1 : 0);
  return { candidates: verified.sort((a, b) => rank(b) - rank(a)), webSources };
}

export async function discoverCompany(
  companyName: string,
  options: Parameters<typeof discoverCompanyUnverified>[1] & {
    verify?: (candidate: CompanyDiscoveryCandidate, opts: { cityHint?: string }) => Promise<CompanyDiscoveryCandidate>;
  } = {}
): Promise<CompanyDiscoveryResult> {
  const result = await discoverCompanyUnverified(companyName, options);
  return verifyCandidates(result.candidates, result.webSources, options);
}

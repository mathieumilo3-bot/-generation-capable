import type { AiAuditWebSource } from "./types";

const DEFAULT_MODEL = "gpt-5.6-sol";
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
  sector: string;
  city: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  insights: CompanyDiscoveryInsight[];
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
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "website",
            "sector",
            "city",
            "summary",
            "confidence",
            "insights",
          ],
          properties: {
            name: { type: "string" },
            website: { type: "string" },
            sector: { type: "string" },
            city: { type: "string" },
            summary: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            insights: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "insight", "evidence"],
                properties: {
                  title: { type: "string" },
                  insight: { type: "string" },
                  evidence: { type: "array", maxItems: 3, items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  };
}

function extractOutputText(body: Record<string, unknown>): string | null {
  if (typeof body.output_text === "string") return body.output_text;
  const output = Array.isArray(body.output) ? body.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const candidate = part as { type?: unknown; text?: unknown };
      if (candidate.type === "output_text" && typeof candidate.text === "string") return candidate.text;
    }
  }
  return null;
}

function extractSources(body: Record<string, unknown>): AiAuditWebSource[] {
  const sourceMap = new Map<string, AiAuditWebSource>();
  const output = Array.isArray(body.output) ? body.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type === "web_search_call" && record.action && typeof record.action === "object") {
      const action = record.action as Record<string, unknown>;
      if (Array.isArray(action.sources)) {
        for (const source of action.sources) {
          if (!source || typeof source !== "object") continue;
          const raw = source as Record<string, unknown>;
          const url = typeof raw.url === "string" ? raw.url.trim() : "";
          const title = typeof raw.title === "string" ? raw.title.trim() : "";
          if (/^https?:\/\//i.test(url)) sourceMap.set(url, { title: title || url, url });
        }
      }
    }
  }

  return Array.from(sourceMap.values()).slice(0, 10);
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeWebsite(value: unknown): string {
  const raw = clean(value, 300);
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
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
    insights,
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
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const nonOfficialHosts = [
        "pagesjaunes.fr",
        "pappers.fr",
        "societe.com",
        "verif.com",
        "facebook.com",
        "instagram.com",
        "linkedin.com",
        "tiktok.com",
        "youtube.com",
        "x.com",
        "twitter.com",
        "google.com",
        "maps.google.com",
      ];
      if (!nonOfficialHosts.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
        website = `${url.protocol}//${url.host}/`;
      }
    } catch {}

    return {
      name: query,
      website,
      sector: "",
      city: "",
      summary: `Une présence web correspondant fortement à « ${query} » a été retrouvée et sera recoupée pendant l'analyse.`,
      confidence: "medium",
      insights: [
        {
          title: "Présence officielle probable retrouvée",
          insight: "Le nom recherché correspond directement à une source web publique identifiable. Le diagnostic va maintenant vérifier le métier, la zone, les preuves et le parcours vers le devis.",
          evidence: [source.title || source.url],
        },
      ],
    };
  }

  return null;
}

async function runDiscoveryAttempt(
  query: string,
  options: {
    fetchFn: FetchLike;
    apiKey: string;
    model: string;
    projectId?: string;
    contextSize: "low" | "medium" | "high";
    rescue?: boolean;
    timeoutMs?: number;
    cityHint?: string;
  }
): Promise<CompanyDiscoveryResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? OPENAI_TIMEOUT_MS);

  try {
    const response = await options.fetchFn("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        ...(options.projectId ? { "OpenAI-Project": options.projectId } : {}),
      },
      body: JSON.stringify({
        model: options.model,
        reasoning: { effort: options.rescue ? "high" : "medium" },
        tools: [{ type: "web_search", search_context_size: options.contextSize }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        max_output_tokens: options.rescue ? 1_700 : 1_300,
        input: [
          {
            role: "system",
            content:
              "Tu es l'analyste GC chargé d'identifier une entreprise réelle à partir de sources web publiques. Tu dois chercher activement, recouper plusieurs sources et ne jamais inventer.",
          },
          {
            role: "user",
            content: `Retrouve l'entreprise correspondant au nom suivant : "${query}".${options.cityHint ? ` La ville ou le code postal fourni par l'utilisateur est : "${options.cityHint}". Utilise-le comme contrainte forte d'identification.` : ""}

MISSION
Tu dois faire comme un consultant humain qui cherche vraiment cette société sur le web avant un audit commercial.

METHODE OBLIGATOIRE
1. Recherche le nom exact entre guillemets, puis le nom + ville/code postal si une ville est fournie.
2. Recherche ensuite plusieurs variantes : nom + entreprise, nom + métier probable, nom + bâtiment/BTP/artisan, puis nom + ville + métier.
3. Cherche explicitement le SITE OFFICIEL : nom + "site officiel", nom + domaine, puis recoupe le domaine trouvé avec les mentions légales, le nom, l'adresse, le téléphone, la ville ou les réseaux sociaux.
4. Utilise les annuaires, Google Business, PagesJaunes, Pappers/Societe, Facebook, Instagram ou LinkedIn comme SOURCES DE RECOUPEMENT, jamais comme website officiel.
5. Si un domaine semble officiel, vérifie au moins deux signaux convergents parmi : nom exact, ville/adresse, téléphone, métier, mentions légales, lien depuis un profil officiel, branding cohérent.
6. Le trafic vient de France : privilégie d'abord les entreprises françaises quand le nom n'indique pas un autre pays.
7. Si plusieurs entreprises portent le même nom, garde plusieurs candidats et baisse confidence. La ville fournie doit départager fortement.
8. Une entreprise peut être identifiée sans site officiel : dans ce cas website reste vide. N'invente jamais un domaine.
9. N'abandonne pas parce qu'un site refuse un accès technique : continue à chercher son domaine via les autres sources publiques.
10. Avant de conclure qu'aucun site n'existe, essaie plusieurs requêtes ciblées et variantes de domaine.

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
- insights : jusqu'à 3 constats spécifiques à cette entreprise, avec preuves.

${options.rescue ? "C'est une tentative de récupération : la première recherche n'a pas donné de candidat exploitable. Élargis les variantes du nom, les annuaires et les réseaux sociaux avant de conclure qu'il n'y a rien." : ""}

Renvoie uniquement le JSON demandé.`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "gc_company_discovery_v2",
            strict: true,
            schema: schema(),
          },
        },
      }),
    });

    if (!response.ok) {
      console.warn("[audit/discovery] OpenAI failed:", response.status);
      return { candidates: [], webSources: [] };
    }

    const body = (await response.json()) as Record<string, unknown>;
    const sources = extractSources(body);
    const outputText = extractOutputText(body);
    if (!outputText) return { candidates: [], webSources: sources };

    const parsed = JSON.parse(outputText) as { candidates?: unknown[] };
    const candidates = Array.isArray(parsed.candidates)
      ? (parsed.candidates.map(sanitizeCandidate).filter(Boolean).slice(0, 3) as CompanyDiscoveryCandidate[])
      : [];

    return { candidates, webSources: sources };
  } catch (error) {
    const label = error instanceof Error ? error.name : "unknown_error";
    console.warn("[audit/discovery] attempt unavailable:", label);
    return { candidates: [], webSources: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverCompany(
  companyName: string,
  options: {
    fetchFn?: FetchLike;
    apiKey?: string;
    model?: string;
    firstTimeoutMs?: number;
    skipRescue?: boolean;
    cityHint?: string;
  } = {}
): Promise<CompanyDiscoveryResult> {
  const query = companyName.trim().slice(0, 160);
  const cityHint = options.cityHint?.trim().slice(0, 120) || "";
  if (query.length < 2) return { candidates: [], webSources: [] };

  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.OPEN_API_KEY;
  if (!apiKey) return { candidates: [], webSources: [] };

  const model = options.model ?? process.env.OPENAI_AUDIT_MODEL ?? DEFAULT_MODEL;
  const projectId = process.env.OPENAI_PROJECT_ID;
  const fetchFn = options.fetchFn ?? fetch;

  const first = await runDiscoveryAttempt(query, {
    fetchFn,
    apiKey,
    model,
    projectId,
    contextSize: "high",
    timeoutMs: options.firstTimeoutMs ?? 32_000,
    cityHint,
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
    model,
    projectId,
    contextSize: "high",
    rescue: true,
    timeoutMs: 26_000,
    cityHint,
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

import type { AiAuditWebSource } from "./types";

const DEFAULT_MODEL = "gpt-5.6-sol";
const OPENAI_TIMEOUT_MS = 19_000;

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

  return Array.from(sourceMap.values()).slice(0, 6);
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

async function runDiscoveryAttempt(
  query: string,
  options: {
    fetchFn: FetchLike;
    apiKey: string;
    model: string;
    projectId?: string;
    contextSize: "low" | "medium";
    rescue?: boolean;
  }
): Promise<CompanyDiscoveryResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

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
        reasoning: { effort: options.rescue ? "medium" : "low" },
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
            content: `Retrouve l'entreprise correspondant au nom suivant : "${query}".

MISSION
Tu dois faire comme un consultant humain qui cherche vraiment cette société sur le web avant un audit commercial.

METHODE OBLIGATOIRE
1. Recherche le nom exact entre guillemets.
2. Recherche ensuite le nom sans guillemets + entreprise, artisan, bâtiment, BTP.
3. Si tu vois une ville, un département, un métier, un dirigeant, un téléphone ou un site qui convergent, recoupe-les.
4. Vérifie le site officiel, Google Business/annuaires professionnels, réseaux sociaux et mentions publiques crédibles quand disponibles.
5. Une entreprise peut être suffisamment identifiée même si son site officiel est absent ou inaccessible : dans ce cas garde website vide mais renseigne activité, zone et constats à partir des sources publiques.
6. Ne renvoie plusieurs candidats que s'il existe une vraie ambiguïté.

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
  options: { fetchFn?: FetchLike; apiKey?: string; model?: string } = {}
): Promise<CompanyDiscoveryResult> {
  const query = companyName.trim().slice(0, 160);
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
    contextSize: "low",
  });

  if (first.candidates.length > 0) return first;

  const rescue = await runDiscoveryAttempt(query, {
    fetchFn,
    apiKey,
    model,
    projectId,
    contextSize: "medium",
    rescue: true,
  });

  return {
    candidates: rescue.candidates,
    webSources: rescue.webSources.length ? rescue.webSources : first.webSources,
  };
}

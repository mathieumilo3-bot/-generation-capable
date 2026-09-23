import type { AiAuditWebSource } from "./types";

const DEFAULT_MODEL = "gpt-5.6-sol";
const OPENAI_TIMEOUT_MS = 22_000;

type FetchLike = typeof fetch;

export type CompanyDiscoveryCandidate = {
  name: string;
  website: string;
  sector: string;
  city: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  insightTitle: string;
  insight: string;
  evidence: string[];
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
            "insightTitle",
            "insight",
            "evidence",
          ],
          properties: {
            name: { type: "string" },
            website: { type: "string" },
            sector: { type: "string" },
            city: { type: "string" },
            summary: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            insightTitle: { type: "string" },
            insight: { type: "string" },
            evidence: { type: "array", maxItems: 3, items: { type: "string" } },
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

  return {
    name,
    website: normalizeWebsite(raw.website),
    sector: clean(raw.sector, 100),
    city: clean(raw.city, 120),
    summary: clean(raw.summary, 420),
    confidence,
    insightTitle: clean(raw.insightTitle, 180),
    insight: clean(raw.insight, 520),
    evidence: Array.isArray(raw.evidence)
      ? raw.evidence.map((item) => clean(item, 220)).filter(Boolean).slice(0, 3)
      : [],
  };
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetchFn("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(projectId ? { "OpenAI-Project": projectId } : {}),
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        tools: [{ type: "web_search", search_context_size: "low" }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        max_output_tokens: 1_200,
        input: [
          {
            role: "system",
            content:
              "Tu identifies des entreprises à partir de sources web publiques. N'invente jamais un site, une ville, une activité ou un fait.",
          },
          {
            role: "user",
            content: `Retrouve l'entreprise correspondant au nom suivant : "${query}".

OBJECTIF
- Le visiteur ne donne que le nom de son entreprise.
- Recherche d'abord la marque exacte, puis les variantes orthographiques évidentes.
- Priorise la France et les entreprises locales/artisans/BTP si plusieurs résultats portent un nom proche, sans exclure un autre résultat si les preuves sont plus fortes.
- Identifie le site officiel uniquement s'il est clairement relié à l'entreprise. Sinon laisse website vide.
- Renvoie jusqu'à 3 candidats uniquement si une vraie ambiguïté existe. Sinon renvoie un seul candidat.
- Pour "sector", utilise si possible l'une de ces valeurs : "Couvreur / toiture", "Plombier / chauffagiste", "Électricien", "Menuisier", "Peintre / façadier", "Maçon", "Paysagiste", "Entreprise générale BTP". Pour un autre métier, écris "Autre — <métier>".
- "summary" = activité + zone en une phrase courte.
- "insightTitle", "insight" et "evidence" doivent fournir UN premier constat commercial concret et utile fondé sur ce qui est réellement visible dans les résultats publics : découvrabilité, clarté de l'offre, preuves, avis, site, prise de contact, cohérence locale. Pas de conseil générique.
- Ne donne aucun chiffre non vérifié. Ne prétends pas mesurer une position Google ou Google Maps exacte.
- confidence = high seulement si nom + activité + zone/site convergent clairement ; medium si le rapprochement est plausible ; low si ambigu.

Renvoie uniquement le JSON demandé.`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "gc_company_discovery_v1",
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
    const outputText = extractOutputText(body);
    if (!outputText) return { candidates: [], webSources: extractSources(body) };

    const parsed = JSON.parse(outputText) as { candidates?: unknown[] };
    const candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates.map(sanitizeCandidate).filter(Boolean).slice(0, 3) as CompanyDiscoveryCandidate[]
      : [];

    return { candidates, webSources: extractSources(body) };
  } catch (error) {
    const label = error instanceof Error ? error.name : "unknown_error";
    console.warn("[audit/discovery] unavailable:", label);
    return { candidates: [], webSources: [] };
  } finally {
    clearTimeout(timer);
  }
}

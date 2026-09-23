import type { AiAuditWebSource } from "./types";

/**
 * Minimal client for the OpenAI Responses API with structured output.
 * Shared by the research and synthesis passes. Never throws: any failure
 * (no key, HTTP error, timeout, unparsable output) returns null so callers
 * can fall back to the deterministic, site-verified diagnostic.
 */

export const DEFAULT_AUDIT_MODEL = "gpt-5.6-sol";

type FetchLike = typeof fetch;

export type ResponsesCall = {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  webSearch?: boolean;
  /** Approximate searcher location for local results (France + city). */
  searchCity?: string;
  effort?: "low" | "medium" | "high";
  maxOutputTokens?: number;
  timeoutMs: number;
  fetchFn?: FetchLike;
  apiKey?: string;
  model?: string;
};

export type ResponsesResult<T> = {
  data: T;
  model: string;
  webQueries: string[];
  webSources: AiAuditWebSource[];
};

export function openAiKey(explicit?: string): string | undefined {
  return explicit ?? process.env.OPENAI_API_KEY ?? process.env.OPEN_API_KEY;
}

export function extractOutputText(body: Record<string, unknown>): string | null {
  if (typeof body.output_text === "string") return body.output_text;
  const output = Array.isArray(body.output) ? body.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const candidate = part as { type?: unknown; text?: unknown };
      if (candidate.type === "output_text" && typeof candidate.text === "string") return candidate.text;
    }
  }
  return null;
}

export function extractWebMetadata(body: Record<string, unknown>): { webQueries: string[]; webSources: AiAuditWebSource[] } {
  const queries = new Set<string>();
  const sources = new Map<string, AiAuditWebSource>();
  const output = Array.isArray(body.output) ? body.output : [];

  const addSource = (raw: Record<string, unknown>) => {
    const url = typeof raw.url === "string" ? raw.url.trim() : "";
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (/^https?:\/\//i.test(url)) sources.set(url, { title: title || url, url });
  };

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type === "web_search_call" && record.action && typeof record.action === "object") {
      const action = record.action as Record<string, unknown>;
      if (typeof action.query === "string" && action.query.trim()) queries.add(action.query.trim().slice(0, 180));
      if (Array.isArray(action.queries)) {
        for (const q of action.queries) if (typeof q === "string" && q.trim()) queries.add(q.trim().slice(0, 180));
      }
      if (Array.isArray(action.sources)) {
        for (const s of action.sources) if (s && typeof s === "object") addSource(s as Record<string, unknown>);
      }
    }
    if (record.type === "message" && Array.isArray(record.content)) {
      for (const part of record.content) {
        if (!part || typeof part !== "object") continue;
        const annotations = (part as Record<string, unknown>).annotations;
        if (!Array.isArray(annotations)) continue;
        for (const annotation of annotations) {
          if (!annotation || typeof annotation !== "object") continue;
          const raw = annotation as Record<string, unknown>;
          addSource(raw.url_citation && typeof raw.url_citation === "object" ? (raw.url_citation as Record<string, unknown>) : raw);
        }
      }
    }
  }
  return { webQueries: [...queries].slice(0, 20), webSources: [...sources.values()].slice(0, 30) };
}

export async function callResponses<T>(call: ResponsesCall): Promise<ResponsesResult<T> | null> {
  const apiKey = openAiKey(call.apiKey);
  if (!apiKey || call.timeoutMs < 2_000) return null;
  const model = call.model ?? process.env.OPENAI_AUDIT_MODEL ?? DEFAULT_AUDIT_MODEL;
  const projectId = process.env.OPENAI_PROJECT_ID;
  const fetchFn = call.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs);

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
        reasoning: { effort: call.effort ?? "medium" },
        ...(call.webSearch
          ? {
              tools: [
                {
                  type: "web_search",
                  search_context_size: "high",
                  user_location: { type: "approximate", country: "FR", ...(call.searchCity ? { city: call.searchCity.slice(0, 60) } : {}) },
                },
              ],
              tool_choice: "required",
              include: ["web_search_call.action.sources"],
            }
          : {}),
        max_output_tokens: call.maxOutputTokens ?? 4_000,
        input: [
          { role: "system", content: call.system },
          { role: "user", content: call.user },
        ],
        text: { format: { type: "json_schema", name: call.schemaName, strict: true, schema: call.schema } },
      }),
    });

    if (!response.ok) {
      console.warn(`[audit/openai] ${call.schemaName} failed:`, response.status);
      return null;
    }
    const body = (await response.json()) as Record<string, unknown>;
    const text = extractOutputText(body);
    if (!text) return null;
    return { data: JSON.parse(text) as T, model, ...extractWebMetadata(body) };
  } catch (error) {
    console.warn(`[audit/openai] ${call.schemaName} unavailable:`, error instanceof Error ? error.name : "unknown_error");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

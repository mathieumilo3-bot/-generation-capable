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

function requestBody(call: ResponsesCall, model: string, background: boolean) {
  return {
    model,
    reasoning: { effort: call.effort ?? "medium" },
    ...(background ? { background: true, store: true } : {}),
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
  };
}

function authHeaders(apiKey: string) {
  const projectId = process.env.OPENAI_PROJECT_ID;
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(projectId ? { "OpenAI-Project": projectId } : {}),
  };
}

export function auditModel(explicit?: string): string {
  return explicit ?? process.env.OPENAI_AUDIT_MODEL ?? DEFAULT_AUDIT_MODEL;
}

/** An OpenAI response id, as issued for a background job. */
export function isResponseId(value: unknown): value is string {
  return typeof value === "string" && /^resp_[A-Za-z0-9_-]{8,120}$/.test(value);
}

/**
 * Starts a long job on OpenAI's side and returns its id immediately.
 *
 * This is what keeps every one of our own HTTP handlers short: the deep
 * research (web search, high reasoning) runs for as long as it needs inside
 * OpenAI, while each request we serve stays a quick POST or poll — well
 * under the host's synchronous function limit. Returns null if background
 * mode is unavailable, so the caller can fall back to a bounded sync call.
 */
export async function startBackgroundResponse(call: ResponsesCall): Promise<string | null> {
  const apiKey = openAiKey(call.apiKey);
  if (!apiKey) return null;
  const model = auditModel(call.model);
  const fetchFn = call.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs);

  try {
    const response = await fetchFn("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: authHeaders(apiKey),
      body: JSON.stringify(requestBody(call, model, true)),
    });
    if (!response.ok) {
      console.warn(`[audit/openai] background start refused (${call.schemaName}):`, response.status);
      return null;
    }
    const body = (await response.json()) as { id?: unknown; status?: unknown };
    return isResponseId(body.id) ? body.id : null;
  } catch (error) {
    console.warn(`[audit/openai] background start unavailable (${call.schemaName}):`, error instanceof Error ? error.name : "unknown_error");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type PollOutcome<T> =
  | { status: "pending" }
  | { status: "done"; result: ResponsesResult<T> }
  | { status: "failed"; reason: string };

/**
 * Reads a background job once. Never throws — a transient network error
 * reports "pending" so the caller simply polls again, and only a terminal
 * OpenAI status (failed, cancelled, incomplete) reports "failed".
 */
export async function pollBackgroundResponse<T>(
  id: string,
  options: { fetchFn?: FetchLike; apiKey?: string; timeoutMs?: number } = {}
): Promise<PollOutcome<T>> {
  const apiKey = openAiKey(options.apiKey);
  if (!apiKey || !isResponseId(id)) return { status: "failed", reason: "invalid_job" };
  const fetchFn = options.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 6_000);

  try {
    const base = `https://api.openai.com/v1/responses/${encodeURIComponent(id)}`;
    let response = await fetchFn(`${base}?include[]=web_search_call.action.sources`, {
      method: "GET",
      signal: controller.signal,
      headers: authHeaders(apiKey),
    });
    // Older API surfaces reject the include filter on retrieval; the job
    // itself is still readable without it.
    if (response.status === 400) {
      response = await fetchFn(base, { method: "GET", signal: controller.signal, headers: authHeaders(apiKey) });
    }
    if (!response.ok) {
      if (response.status === 404) return { status: "failed", reason: "unknown_job" };
      console.warn("[audit/openai] poll failed:", response.status);
      return { status: "pending" };
    }

    const body = (await response.json()) as Record<string, unknown>;
    const openAiStatus = String(body.status ?? "");
    if (openAiStatus === "queued" || openAiStatus === "in_progress") return { status: "pending" };
    if (openAiStatus !== "completed") return { status: "failed", reason: openAiStatus || "unknown_status" };

    const text = extractOutputText(body);
    if (!text) return { status: "failed", reason: "empty_output" };
    return {
      status: "done",
      result: { data: JSON.parse(text) as T, model: typeof body.model === "string" ? body.model : "", ...extractWebMetadata(body) },
    };
  } catch (error) {
    const label = error instanceof Error ? error.name : "unknown_error";
    // A timeout or parse error on one poll is not a dead job.
    console.warn("[audit/openai] poll unavailable:", label);
    return label === "SyntaxError" ? { status: "failed", reason: "unparsable_output" } : { status: "pending" };
  } finally {
    clearTimeout(timer);
  }
}

export async function callResponses<T>(call: ResponsesCall): Promise<ResponsesResult<T> | null> {
  const apiKey = openAiKey(call.apiKey);
  if (!apiKey || call.timeoutMs < 2_000) return null;
  const model = auditModel(call.model);
  const fetchFn = call.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs);

  try {
    const response = await fetchFn("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: authHeaders(apiKey),
      body: JSON.stringify(requestBody(call, model, false)),
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

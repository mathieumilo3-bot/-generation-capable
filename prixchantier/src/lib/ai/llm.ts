import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { ZodError, type z } from "zod";

/**
 * Couche IA unique. Toutes les réponses sont contraintes par un schéma JSON
 * strict (Structured Outputs) puis revalidées par zod : aucune réponse libre
 * n'est jamais utilisée.
 *
 * Réutilisation : API Responses + modèle par défaut repris de la fonction
 * `supabase/functions/video-intelligence` (intégration OpenAI déjà en
 * production sur ce compte) ; taxonomie des pannes adaptée de
 * `video-editor/packages/model-router` (auth/crédit = définitif,
 * débit/délai/panne/réseau = réessayable).
 */

export const DEFAULT_MODEL = "gpt-5.6-luna";

export type LlmPart =
  | { type: "text"; text: string }
  | { type: "pdf"; filename: string; data: Buffer };

export type LlmContext = { organizationId?: string | null; projectId?: string | null };

export type StructuredRequest<S extends z.ZodType> = {
  name: string;
  system: string;
  content: string | LlmPart[];
  schema: S;
  context?: LlmContext;
};

export interface Llm {
  structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>>;
}

export type AiFailureKind =
  | "not_configured"
  | "auth"
  | "credit"
  | "rate_limit"
  | "timeout"
  | "provider_down"
  | "network"
  | "invalid_request"
  | "truncated"
  | "refused"
  | "invalid_output";

const USER_MESSAGES: Record<AiFailureKind, string> = {
  not_configured: "L'analyse IA n'est pas configurée (OPENAI_API_KEY manquante).",
  auth: "La clé OpenAI est invalide ou révoquée : l'analyse automatique est indisponible.",
  credit: "Le crédit OpenAI est épuisé : l'analyse automatique est indisponible.",
  rate_limit: "Le service d'analyse est saturé, nouvel essai automatique.",
  timeout: "L'analyse a pris trop de temps, nouvel essai automatique.",
  provider_down: "Le service d'analyse est momentanément indisponible, nouvel essai automatique.",
  network: "Connexion au service d'analyse impossible, nouvel essai automatique.",
  invalid_request: "Ce document n'a pas pu être soumis à l'analyse.",
  truncated: "Document trop long pour une seule passe d'analyse.",
  refused: "L'IA a refusé d'analyser ce contenu.",
  invalid_output: "Réponse IA non conforme : analyse à relancer.",
};

const RETRYABLE: ReadonlySet<AiFailureKind> = new Set(["rate_limit", "timeout", "provider_down", "network", "invalid_output"]);

/** Échec IA typé : le moteur de tâches sait s'il faut réessayer, l'interface sait quoi afficher. */
export class AiFailure extends Error {
  readonly retryable: boolean;
  constructor(
    readonly kind: AiFailureKind,
    detail?: string,
  ) {
    super(USER_MESSAGES[kind] + (detail && process.env.NODE_ENV !== "production" ? ` (${detail})` : ""));
    this.name = "AiFailure";
    this.retryable = RETRYABLE.has(kind);
  }
  get userMessage() {
    return USER_MESSAGES[this.kind];
  }
}

/** Classe une erreur du SDK OpenAI (erreurs typées, pas d'analyse de texte). */
export function classifyOpenAiError(err: unknown): AiFailure {
  if (err instanceof AiFailure) return err;
  // Sortie non conforme au schéma (validée par le SDK) ou JSON illisible.
  if (err instanceof ZodError || err instanceof SyntaxError) return new AiFailure("invalid_output", err.message.slice(0, 200));
  if (err instanceof APIConnectionTimeoutError) return new AiFailure("timeout");
  if (err instanceof APIConnectionError) return new AiFailure("network");
  if (err instanceof APIError) {
    const code = String(err.code ?? "");
    if (err.status === 401 || err.status === 403) return new AiFailure("auth", `HTTP ${err.status}`);
    if (err.status === 402 || code === "insufficient_quota" || code === "billing_hard_limit_reached") return new AiFailure("credit", code);
    if (err.status === 429) return new AiFailure("rate_limit");
    if (err.status === 408) return new AiFailure("timeout");
    if (typeof err.status === "number" && err.status >= 500) return new AiFailure("provider_down", `HTTP ${err.status}`);
    if (err.status === 400 || err.status === 404 || err.status === 413 || err.status === 422) return new AiFailure("invalid_request", code || `HTTP ${err.status}`);
  }
  return new AiFailure("provider_down", err instanceof Error ? err.message : String(err));
}

export type UsageRecorder = (entry: {
  task: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  ok: boolean;
  context?: LlmContext;
}) => void;

class OpenAiLlm implements Llm {
  private client: OpenAI;
  constructor(
    apiKey: string,
    private model: string,
    private recordUsage?: UsageRecorder,
  ) {
    // Les réessais de tâche sont gérés par la file (avec backoff) : un seul réessai réseau ici.
    this.client = new OpenAI({ apiKey, timeout: 180_000, maxRetries: 1 });
  }

  async structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
    const content: ResponseInputContent[] =
      typeof req.content === "string"
        ? [{ type: "input_text", text: req.content }]
        : req.content.map((p) =>
            p.type === "text"
              ? { type: "input_text" as const, text: p.text }
              : { type: "input_file" as const, filename: p.filename, file_data: `data:application/pdf;base64,${p.data.toString("base64")}` },
          );
    const started = Date.now();
    let usage = { input: 0, output: 0 };
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: req.system,
        input: [{ role: "user", content }],
        text: { format: zodTextFormat(req.schema, req.name) },
      });
      usage = { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 };
      if (response.status === "incomplete") {
        throw new AiFailure(response.incomplete_details?.reason === "content_filter" ? "refused" : "truncated");
      }
      const refused = response.output.some(
        (o) => o.type === "message" && o.content.some((c) => c.type === "refusal"),
      );
      if (refused) throw new AiFailure("refused");
      if (response.output_parsed == null) throw new AiFailure("invalid_output", "aucune sortie structurée");
      // Double validation : le SDK a déjà parsé, on revalide pour les raffinements zod.
      const parsed = req.schema.safeParse(response.output_parsed);
      if (!parsed.success) throw new AiFailure("invalid_output", parsed.error.issues[0]?.message);
      this.recordUsage?.({ task: req.name, model: this.model, inputTokens: usage.input, outputTokens: usage.output, durationMs: Date.now() - started, ok: true, context: req.context });
      return parsed.data;
    } catch (err) {
      this.recordUsage?.({ task: req.name, model: this.model, inputTokens: usage.input, outputTokens: usage.output, durationMs: Date.now() - started, ok: false, context: req.context });
      throw classifyOpenAiError(err);
    }
  }
}

let override: Llm | null = null;
let usageRecorder: UsageRecorder | undefined;

/** Réservé aux tests : injecte un modèle déterministe. */
export function setLlmForTests(llm: Llm | null) {
  override = llm;
}

/** Branché par le serveur pour tenir le journal de consommation (voir usage.ts). */
export function setUsageRecorder(recorder: UsageRecorder) {
  usageRecorder = recorder;
}

export function aiConfigured() {
  return Boolean(override || process.env.OPENAI_API_KEY);
}

export function getLlm(): Llm {
  if (override) return override;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiFailure("not_configured");
  return new OpenAiLlm(key, process.env.OPENAI_MODEL || DEFAULT_MODEL, usageRecorder);
}

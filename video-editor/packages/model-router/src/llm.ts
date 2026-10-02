import { llmCostMicroUsd } from "./pricing.js";
import { ProviderError, type ProviderCallResult } from "./types.js";

export interface LLMCompleteParams {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface LLMProvider {
  readonly isReal: boolean;
  complete(params: LLMCompleteParams): Promise<ProviderCallResult<string>>;
}

/**
 * Fournisseur réel — Anthropic Messages API. Un seul fournisseur LLM
 * branché aujourd'hui, mais tout appelant passe par l'interface
 * `LLMProvider`, jamais par ce type concret : remplacer par GPT-5 ou
 * ajouter un second fournisseur en parallèle (§06 du dossier stratégique
 * : ne jamais dépendre d'un seul fournisseur) ne touche que ce fichier.
 */
export class AnthropicLLMProvider implements LLMProvider {
  readonly isReal = true;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(opts: { apiKey: string; baseUrl?: string; model?: string }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
    this.model = opts.model ?? "claude-sonnet-4-5";
  }

  async complete(params: LLMCompleteParams): Promise<ProviderCallResult<string>> {
    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: params.maxTokens ?? 1024,
          system: params.system,
          messages: [{ role: "user", content: params.prompt }],
        }),
      });
    } catch (err) {
      throw new ProviderError("anthropic", "Échec réseau", err);
    }
    if (!res.ok) {
      throw new ProviderError("anthropic", `HTTP ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      content: { type: string; text?: string }[];
      usage: { input_tokens: number; output_tokens: number };
    };
    const text = json.content.find((c) => c.type === "text")?.text ?? "";
    const inputTokens = json.usage.input_tokens;
    const outputTokens = json.usage.output_tokens;
    return {
      data: text,
      provider: "anthropic",
      model: this.model,
      inputUnits: inputTokens,
      inputUnitType: "tokens",
      outputUnits: outputTokens,
      outputUnitType: "tokens",
      durationMs: Date.now() - start,
      costMicroUsd: llmCostMicroUsd(inputTokens, outputTokens),
      isStub: false,
    };
  }
}

/**
 * Aucune clé configurée : renvoie un marqueur explicite plutôt qu'un
 * texte plausible mais inventé. Les agents appelants doivent vérifier
 * `router.capabilities.llm` avant d'utiliser cette sortie comme du JSON —
 * voir packages/agents pour le repli déterministe (§22 : une règle
 * déterministe fiable plutôt qu'un IA quand elle est indisponible).
 */
export class StubLLMProvider implements LLMProvider {
  readonly isReal = false;

  async complete(_params: LLMCompleteParams): Promise<ProviderCallResult<string>> {
    return {
      data: "[[STUB:NO_LLM_API_KEY]]",
      provider: "stub",
      model: "stub-llm",
      inputUnits: 0,
      inputUnitType: "tokens",
      outputUnits: 0,
      outputUnitType: "tokens",
      durationMs: 0,
      costMicroUsd: 0,
      isStub: true,
    };
  }
}

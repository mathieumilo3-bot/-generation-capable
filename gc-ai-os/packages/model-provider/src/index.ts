/**
 * Couche modèle (voir docs/gc-ai-os/05-connecteurs.md, "Modèles LLM comme
 * cas particulier de connecteur"). Un agent ne parle jamais directement à
 * une API de modèle : il passe par un `ModelProvider`, remplaçable
 * indépendamment de l'agent.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelCompletion {
  text: string;
  mode: "anthropic" | "fallback";
}

export interface ModelProvider {
  readonly mode: "anthropic" | "fallback";
  complete(messages: ChatMessage[]): Promise<ModelCompletion>;
}

const ANTHROPIC_MODEL = "claude-sonnet-5";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Appelle l'API Anthropic directement (fetch, pas de SDK) pour garder ce
 * package sans dépendance. Utilisé quand `ANTHROPIC_API_KEY` est défini
 * côté serveur — jamais exposé au client.
 */
export class AnthropicModelProvider implements ModelProvider {
  readonly mode = "anthropic" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = ANTHROPIC_MODEL,
  ) {}

  async complete(messages: ChatMessage[]): Promise<ModelCompletion> {
    const system = messages.find((m) => m.role === "system")?.content;
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: conversation,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API a répondu ${response.status} : ${body}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = (data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();

    return { text, mode: "anthropic" };
  }
}

/**
 * Utilisé quand aucune clé de modèle n'est configurée. Ne simule jamais
 * une intelligence qu'il n'a pas : il dit explicitement à l'utilisateur
 * qu'il est en mode démonstration hors-ligne et comment activer le vrai
 * modèle. Le reste du pipeline (routage, RBAC, audit, mémoire) tourne
 * quand même réellement dans ce mode.
 */
export class FallbackModelProvider implements ModelProvider {
  readonly mode = "fallback" as const;

  async complete(messages: ChatMessage[]): Promise<ModelCompletion> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const excerpt = lastUserMessage?.content.slice(0, 240) ?? "";

    const text =
      `Mode démonstration hors-ligne (aucune ANTHROPIC_API_KEY configurée).\n\n` +
      `Message reçu : « ${excerpt} »\n\n` +
      `Le routage, la vérification de permissions et la journalisation d'audit ` +
      `viennent réellement de s'exécuter pour ce message — seule la génération ` +
      `de réponse est simulée. Ajoute ANTHROPIC_API_KEY dans ` +
      `apps/web/.env.local puis redémarre pour obtenir de vraies réponses.`;

    return { text, mode: "fallback" };
  }
}

export function createModelProvider(env: NodeJS.ProcessEnv = process.env): ModelProvider {
  const apiKey = env.ANTHROPIC_API_KEY;
  return apiKey ? new AnthropicModelProvider(apiKey) : new FallbackModelProvider();
}

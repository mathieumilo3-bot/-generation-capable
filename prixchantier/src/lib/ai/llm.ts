import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { z } from "zod";

/**
 * Couche IA unique. Toutes les réponses sont contraintes par un schéma JSON
 * strict (Structured Outputs) puis revalidées par zod : aucune réponse libre
 * n'est jamais utilisée.
 */

export type LlmPart =
  | { type: "text"; text: string }
  | { type: "pdf"; filename: string; data: Buffer };

export type StructuredRequest<S extends z.ZodType> = {
  name: string;
  system: string;
  content: string | LlmPart[];
  schema: S;
};

export interface Llm {
  structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>>;
}

export class AiUnavailableError extends Error {
  constructor() {
    super("L'analyse IA n'est pas configurée (OPENAI_API_KEY manquante).");
    this.name = "AiUnavailableError";
  }
}

export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}

class OpenAiLlm implements Llm {
  private client: OpenAI;
  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new OpenAI({ apiKey, timeout: 180_000, maxRetries: 2 });
  }

  async structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
    const content: ChatCompletionContentPart[] | string =
      typeof req.content === "string"
        ? req.content
        : req.content.map((p) =>
            p.type === "text"
              ? { type: "text" as const, text: p.text }
              : {
                  type: "file" as const,
                  file: {
                    filename: p.filename,
                    file_data: `data:application/pdf;base64,${p.data.toString("base64")}`,
                  },
                },
          );
    const completion = await this.client.chat.completions.parse({
      model: this.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content },
      ],
      response_format: zodResponseFormat(req.schema, req.name),
    });
    const choice = completion.choices[0];
    if (!choice) throw new AiOutputError("Réponse IA vide.");
    if (choice.finish_reason === "length") {
      throw new AiOutputError("Document trop long pour une seule passe d'analyse.");
    }
    if (choice.message.refusal) throw new AiOutputError("L'IA a refusé d'analyser ce contenu.");
    if (!choice.message.parsed) throw new AiOutputError("Réponse IA non conforme au schéma.");
    // Double validation : le SDK a déjà parsé, on revalide pour les raffinements zod.
    return req.schema.parse(choice.message.parsed);
  }
}

let override: Llm | null = null;

/** Réservé aux tests : injecte un modèle déterministe. */
export function setLlmForTests(llm: Llm | null) {
  override = llm;
}

export function aiConfigured() {
  return Boolean(override || process.env.OPENAI_API_KEY);
}

export function getLlm(): Llm {
  if (override) return override;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiUnavailableError();
  return new OpenAiLlm(key, process.env.OPENAI_MODEL || "gpt-5-mini");
}

import type { ChatMessage, ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest, Task, TaskResult } from "@gc-ai-os/shared-types";
import { BaseAgent } from "./base-agent";
import { GC_BUSINESS_CONTEXT } from "./business-context";
import { FOUNDER_OPERATING_MANUAL } from "./operating-manual";

export interface ConversationalReply {
  text: string;
  /** true si l'agent a refusé d'agir et a escaladé plutôt que de simuler une action critique. */
  escalated: boolean;
}

/**
 * Agent conversationnel générique : construit un prompt système à partir
 * de son manifeste (voir docs/gc-ai-os/03-agents.md) et répond via un
 * `ModelProvider`. Une action classée critique par le sous-agent
 * (`criticalPatterns`) n'est jamais exécutée ni simulée comme faite —
 * l'agent explique qu'elle nécessite le connecteur réel et une
 * validation humaine (voir docs/gc-ai-os/06-securite.md), conformément
 * au principe : ne jamais prétendre avoir agi quand ce n'est pas le cas.
 */
export abstract class ConversationalAgent extends BaseAgent {
  abstract readonly manifest: AgentManifest;
  protected abstract readonly criticalPatterns: RegExp[];

  constructor(private readonly model: ModelProvider) {
    super();
  }

  protected buildSystemPrompt(): string {
    const { name, role, responsibilities } = this.manifest;
    return [
      `Tu es ${name}, un agent de GC AI OS, le système d'exploitation d'agents IA de Génération Capable.`,
      `Rôle : ${role}`,
      `Responsabilités : ${responsibilities.join("; ")}`,
      "",
      FOUNDER_OPERATING_MANUAL,
      "",
      GC_BUSINESS_CONTEXT,
      "",
      "Ce système en est à sa phase 1 : tu ne peux pas encore exécuter d'actions réelles " +
        "sur des systèmes externes (déploiement, migration, etc.) — seule la conversation " +
        "est implémentée. Si on te demande une action réelle, explique clairement que " +
        "cette capacité n'est pas encore connectée plutôt que de prétendre l'avoir faite.",
      "Réponds en français, de façon concise, directe et utile.",
    ].join("\n");
  }

  async converse(history: ChatMessage[]): Promise<ConversationalReply> {
    const lastUserMessage = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

    const triggeredPattern = this.criticalPatterns.find((pattern) => pattern.test(lastUserMessage));
    if (triggeredPattern) {
      return {
        escalated: true,
        text:
          `Cette demande correspond à une action critique (voir docs/gc-ai-os/06-securite.md). ` +
          `Le connecteur qui l'exécuterait n'est pas encore implémenté dans ce squelette, et même ` +
          `une fois implémenté, une action de ce niveau de risque nécessiterait une validation ` +
          `humaine explicite avant exécution — je ne peux donc ni la faire ni prétendre l'avoir faite.`,
      };
    }

    const completion = await this.model.complete([
      { role: "system", content: this.buildSystemPrompt() },
      ...history,
    ]);

    return { text: completion.text, escalated: false };
  }

  protected async execute(task: Task): Promise<TaskResult> {
    const reply = await this.converse([{ role: "user", content: task.description }]);
    return {
      status: reply.escalated ? "escalated" : "completed",
      summary: reply.text,
    };
  }
}

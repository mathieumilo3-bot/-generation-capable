import { BaseAgent } from "@gc-ai-os/agents-core";
import type { AgentManifest, Task, TaskResult } from "@gc-ai-os/shared-types";

/**
 * CTO Agent (voir docs/gc-ai-os/03-agents.md). Garant de l'architecture
 * technique et des standards de qualité. Squelette de phase 1 : la
 * logique de revue réelle (appel modèle, lecture du code via le
 * connecteur GitHub) est un chantier séparé de ce scaffold
 * d'architecture.
 */
export class CtoAgent extends BaseAgent {
  readonly manifest: AgentManifest = {
    id: "cto-agent",
    name: "CTO Agent",
    domain: "architecture-technique",
    role: "Garant de l'architecture technique et des standards de qualité",
    responsibilities: [
      "Revue d'architecture avant tout développement significatif",
      "Arbitrage technique entre les agents de développement",
      "Maintien des standards de code (Clean Architecture, SOLID, TS strict)",
    ],
    tools: ["github.create_pull_request"],
    memory: {
      scope: "agent",
      readAccess: ["global", "technical", "project"],
    },
    model: "claude-sonnet-5",
  };

  protected async execute(task: Task): Promise<TaskResult> {
    return {
      status: "escalated",
      summary: `Revue d'architecture non implémentée dans ce squelette (tâche: ${task.title}).`,
    };
  }
}

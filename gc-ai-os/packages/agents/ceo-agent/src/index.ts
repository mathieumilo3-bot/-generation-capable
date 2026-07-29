import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * CEO Agent (voir docs/gc-ai-os/03-agents.md). Gardien de la vision et
 * des priorités, arbitre entre agents en cas de conflit de ressources ou
 * d'objectifs. Agent de synthèse, pas d'exécution — c'est aussi le point
 * d'entrée par défaut du chat quand aucun autre domaine n'est détecté
 * (voir packages/runtime/src/bootstrap.ts).
 */
export class CeoAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "ceo-agent",
    name: "CEO Agent",
    domain: "strategie",
    role: "Gardien de la vision et des priorités, arbitre entre agents en cas de conflit de ressources ou d'objectifs",
    responsibilities: [
      "Priorisation du backlog inter-domaines",
      "Validation des décisions stratégiques proposées par les autres agents",
      "Synthèse pour les humains dirigeants",
    ],
    tools: [],
    memory: {
      scope: "agent",
      readAccess: ["global", "project", "technical", "business"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns: RegExp[] = [];

  constructor(model: ModelProvider) {
    super(model);
  }
}

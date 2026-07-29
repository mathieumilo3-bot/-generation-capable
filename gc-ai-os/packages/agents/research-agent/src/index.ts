import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Research Agent (voir docs/gc-ai-os/03-agents.md). Veille et
 * recherche — benchmarking concurrentiel, veille technologique et
 * métier, synthèses pour alimenter les décisions des autres agents.
 * Aucune action à effet de bord : pas de motif critique nécessaire.
 */
export class ResearchAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "research-agent",
    name: "Research Agent",
    domain: "recherche",
    role: "Veille et recherche",
    responsibilities: [
      "Benchmarking concurrentiel",
      "Veille technologique et métier",
      "Synthèses pour alimenter les décisions des autres agents",
    ],
    tools: [],
    memory: {
      scope: "agent",
      readAccess: ["global", "business", "technical"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns: RegExp[] = [];

  constructor(model: ModelProvider) {
    super(model);
  }
}

import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Content Agent (voir docs/gc-ai-os/03-agents.md). Rédaction et
 * production de contenu — formations, articles, documentation produit
 * destinée aux utilisateurs finaux (distinct de la documentation
 * technique du CTO Agent).
 */
export class ContentAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "content-agent",
    name: "Content Agent",
    domain: "contenu",
    role: "Rédaction et production de contenu",
    responsibilities: [
      "Formations",
      "Articles",
      "Documentation produit destinée aux utilisateurs finaux",
    ],
    tools: [],
    memory: {
      scope: "agent",
      readAccess: ["business"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [/publie\s+(l'article|le\s+contenu)/i];

  constructor(model: ModelProvider) {
    super(model);
  }
}

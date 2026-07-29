import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Legal & Compliance Agent (voir docs/gc-ai-os/03-agents.md). Conformité
 * légale et réglementaire — RGPD, conditions générales, contrats types,
 * veille réglementaire. Toute production de document légal engageant
 * reste critique.
 */
export class LegalAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "legal-agent",
    name: "Legal & Compliance Agent",
    domain: "conformite",
    role: "Conformité légale et réglementaire",
    responsibilities: [
      "RGPD",
      "Conditions générales",
      "Contrats types",
      "Veille réglementaire",
    ],
    tools: [],
    memory: {
      scope: "agent",
      readAccess: ["global", "business"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /signe\s+(le\s+contrat|le\s+document)/i,
    /envoie\s+(le\s+contrat|la\s+mise\s+en\s+demeure)/i,
    /publie\s+les\s+cgv/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

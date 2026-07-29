import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Marketing Agent (voir docs/gc-ai-os/03-agents.md). Stratégie et
 * exécution marketing : campagnes, contenu, analyse de performance.
 * Chez Génération Capable, cela couvre notamment l'acquisition vers
 * l'Académie gratuite et la conversion vers l'abonnement Pro.
 */
export class MarketingAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "marketing-agent",
    name: "Marketing Agent",
    domain: "marketing",
    role: "Stratégie et exécution marketing",
    responsibilities: [
      "Campagnes et contenu marketing",
      "Analyse de performance (SEO, réseaux sociaux, conversion)",
    ],
    tools: ["resend.send_campaign"],
    memory: {
      scope: "agent",
      readAccess: ["business", "project"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /envoie\s+(la\s+)?campagne/i,
    /publie\s+(le|la)\s+(post|contenu)/i,
    /lance\s+la\s+campagne/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

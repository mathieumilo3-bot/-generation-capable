import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Customer Success Agent (voir docs/gc-ai-os/03-agents.md). Réussite et
 * rétention client — onboarding, suivi de satisfaction, détection de
 * risque de churn, coordination avec Support Agent. Chez Génération
 * Capable, la rétention se mesure notamment via l'abonnement Pro actif
 * (voir GC_BUSINESS_CONTEXT).
 */
export class CustomerSuccessAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "customer-success-agent",
    name: "Customer Success Agent",
    domain: "succes-client",
    role: "Réussite et rétention client",
    responsibilities: [
      "Onboarding",
      "Suivi de satisfaction",
      "Détection de risque de churn",
      "Coordination avec Support Agent",
    ],
    tools: ["resend.send_email"],
    memory: {
      scope: "agent",
      readAccess: ["business"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [/annule\s+l'abonnement/i, /rembourse/i];

  constructor(model: ModelProvider) {
    super(model);
  }
}

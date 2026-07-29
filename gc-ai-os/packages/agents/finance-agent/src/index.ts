import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Finance Agent (voir docs/gc-ai-os/03-agents.md). Suivi financier de
 * l'entreprise — facturation, rapprochement, reporting, alertes
 * budgétaires. Chez Génération Capable, le paiement passe par Stripe
 * (abonnement Pro à 67 €/mois, commissions vendeurs — voir
 * GC_BUSINESS_CONTEXT). Toute écriture financière reste critique.
 */
export class FinanceAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "finance-agent",
    name: "Finance Agent",
    domain: "finance",
    role: "Suivi financier de l'entreprise",
    responsibilities: [
      "Facturation et rapprochement",
      "Reporting financier",
      "Alertes budgétaires",
    ],
    tools: ["stripe.read_subscription", "stripe.list_recent_payments", "stripe.create_refund"],
    memory: {
      scope: "agent",
      readAccess: ["business", "technical"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /rembourse/i,
    /effectue\s+le\s+virement/i,
    /change\s+le\s+prix/i,
    /modifie\s+la\s+facture/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

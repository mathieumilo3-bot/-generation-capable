import type { Connector, ConnectorExecutionContext, ConnectorResult } from "@gc-ai-os/shared-types";

/**
 * Connecteur Stripe (voir docs/gc-ai-os/05-connecteurs.md). Génération
 * Capable utilise déjà Stripe en production (abonnement Pro à 67 €/mois,
 * webhook Netlify séparé — voir GC_BUSINESS_CONTEXT). Ce squelette
 * déclare les capacités que le Finance Agent aura besoin d'invoquer ;
 * l'implémentation réelle (appels à l'API Stripe) est un chantier
 * séparé du scaffold d'architecture, volontairement non fait ici pour
 * ne pas toucher à un flux de paiement réel sans revue dédiée.
 */
export class StripeConnector implements Connector {
  readonly id = "stripe";

  readonly capabilities = [
    { name: "read_subscription", riskLevel: "low" as const },
    { name: "list_recent_payments", riskLevel: "low" as const },
    { name: "create_refund", riskLevel: "critical" as const },
  ];

  async execute<T = unknown>(
    capability: string,
    params: Record<string, unknown>,
    _context: ConnectorExecutionContext,
  ): Promise<ConnectorResult<T>> {
    switch (capability) {
      case "read_subscription":
      case "list_recent_payments":
      case "create_refund":
        return {
          ok: false,
          error: `Capacité "${capability}" déclarée mais non implémentée (squelette phase 1). params=${JSON.stringify(params)}`,
        };
      default:
        return { ok: false, error: `Capacité inconnue : ${capability}` };
    }
  }
}

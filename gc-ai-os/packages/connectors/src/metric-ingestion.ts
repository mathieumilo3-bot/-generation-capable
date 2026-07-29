import type { ConnectorGateway } from "./gateway";
import type { StripeSnapshot } from "./stripe-connector";

export interface MetricSink {
  record(metricId: string, value: number, source: "stripe" | "supabase" | "github" | "social"): Promise<void>;
}

export interface IngestionResult {
  ingested: string[];
  skipped: Array<{ metricId: string; reason: string }>;
  error: string | null;
}

/**
 * Ingestion des métriques Stripe (voir docs/gc-ai-os/14-executive-brain.md).
 *
 * Passe **obligatoirement** par `ConnectorGateway` plutôt que d'appeler
 * le connecteur directement. C'est ce qui rend la garantie d'architecture
 * vraie dans les faits et non seulement sur le papier : la lecture est
 * soumise au RBAC, journalisée dans l'audit, et refusée si la permission
 * n'a pas été accordée — exactement comme n'importe quelle action d'agent.
 *
 * Une métrique que Stripe ne permet pas de calculer de façon
 * significative n'est pas écrite. Elle reste « non mesurée », ce qui est
 * l'information juste — et non zéro, qui serait un mensonge.
 */
export async function ingestStripeMetrics(
  gateway: ConnectorGateway,
  sink: MetricSink,
  actor: { agentId: string; roleId: string },
): Promise<IngestionResult> {
  const result = await gateway.call<StripeSnapshot>({
    agentId: actor.agentId,
    roleId: actor.roleId,
    connectorId: "stripe",
    capability: "read_subscription",
    params: {},
    taskId: null,
  });

  if (!result.ok || !result.data) {
    return { ingested: [], skipped: [], error: result.error ?? "Réponse Stripe vide." };
  }

  const snapshot = result.data;
  const ingested: string[] = [];
  const skipped: IngestionResult["skipped"] = [];

  await sink.record("active_subscriptions", snapshot.activeSubscriptions, "stripe");
  ingested.push("active_subscriptions");

  await sink.record("mrr", snapshot.mrrEuros, "stripe");
  ingested.push("mrr");

  // Le nombre de clients est aujourd'hui assimilé aux abonnements
  // actifs. C'est exact tant qu'un client n'a qu'un abonnement — à
  // revoir si l'offre évolue.
  await sink.record("total_customers", snapshot.activeSubscriptions, "stripe");
  ingested.push("total_customers");

  if (snapshot.churnRatePercent !== null) {
    await sink.record("churn_rate", snapshot.churnRatePercent, "stripe");
    ingested.push("churn_rate");
  } else {
    skipped.push({
      metricId: "churn_rate",
      reason: "Base d'abonnés trop petite (< 10) pour un taux de résiliation significatif.",
    });
  }

  return { ingested, skipped, error: null };
}

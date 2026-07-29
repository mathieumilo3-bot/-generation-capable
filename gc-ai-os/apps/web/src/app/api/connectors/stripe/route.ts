import { ingestStripeMetrics } from "@gc-ai-os/connectors";
import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

export const maxDuration = 120;

/**
 * Lit Stripe et alimente les métriques du CFO Brain.
 *
 * Passe par `ConnectorGateway` : la lecture est soumise au RBAC et
 * journalisée dans l'audit, exactement comme une action d'agent. C'est
 * ce qui rend la garantie de sécurité vraie dans les faits.
 */
export async function POST() {
  const { gateway, metrics } = getRuntime();

  const result = await ingestStripeMetrics(
    gateway,
    {
      async record(metricId, value, source) {
        await metrics.record(metricId, value, source);
      },
    },
    { agentId: "metric-ingestion", roleId: "metric-ingestion" },
  );

  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, ...result });
}

/** État de configuration du connecteur, sans jamais exposer la clé. */
export async function GET() {
  const { connectors } = getRuntime();
  const stripe = connectors.get("stripe");

  return NextResponse.json({
    connected: Boolean(process.env.STRIPE_SECRET_KEY),
    capabilities: stripe?.capabilities ?? [],
    hint: process.env.STRIPE_SECRET_KEY
      ? "Clé détectée. POST sur cette route pour ingérer les métriques."
      : "Ajoute STRIPE_SECRET_KEY dans apps/web/.env.local pour activer la lecture Stripe.",
  });
}

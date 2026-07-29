import type { Connector, ConnectorExecutionContext, ConnectorResult } from "@gc-ai-os/shared-types";

const STRIPE_API = "https://api.stripe.com/v1";

interface StripeSubscription {
  status: string;
  items?: { data?: Array<{ price?: { unit_amount?: number; recurring?: { interval?: string } } }> };
}

interface StripeList<T> {
  data?: T[];
  has_more?: boolean;
}

export interface StripeSnapshot {
  activeSubscriptions: number;
  /** Revenu récurrent mensuel en euros, normalisé depuis les intervalles Stripe. */
  mrrEuros: number;
  canceledLast30Days: number;
  /** Taux de résiliation mensuel en %, `null` si la base est trop petite pour être significative. */
  churnRatePercent: number | null;
}

/**
 * Connecteur Stripe (voir docs/gc-ai-os/05-connecteurs.md).
 *
 * Premier connecteur réellement implémenté. Volontairement **en lecture
 * seule sur les capacités non critiques** : `read_subscription` et
 * `list_recent_payments` appellent l'API, `create_refund` reste refusée
 * ici même si le RBAC l'autorisait — un remboursement est irréversible
 * et sera implémenté dans un chantier dédié avec sa propre revue.
 *
 * La clé n'est jamais exposée à un agent ni placée dans un prompt : elle
 * est détenue par ce module et injectée au moment de l'appel.
 */
export class StripeConnector implements Connector {
  readonly id = "stripe";

  readonly capabilities = [
    { name: "read_subscription", riskLevel: "low" as const },
    { name: "list_recent_payments", riskLevel: "low" as const },
    { name: "create_refund", riskLevel: "critical" as const },
  ];

  constructor(private readonly apiKey: string | undefined = process.env.STRIPE_SECRET_KEY) {}

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  async execute<T = unknown>(
    capability: string,
    params: Record<string, unknown>,
    _context: ConnectorExecutionContext,
  ): Promise<ConnectorResult<T>> {
    if (!this.apiKey) {
      return {
        ok: false,
        error:
          "STRIPE_SECRET_KEY absente. Renseigne-la dans apps/web/.env.local — " +
          "aucune donnée Stripe ne peut être lue sans elle.",
      };
    }

    switch (capability) {
      case "read_subscription": {
        const snapshot = await this.snapshot();
        return { ok: true, data: snapshot as T };
      }

      case "list_recent_payments": {
        const limit = typeof params.limit === "number" ? params.limit : 10;
        const charges = await this.get<StripeList<Record<string, unknown>>>(
          `/charges?limit=${Math.min(limit, 100)}`,
        );
        return { ok: true, data: (charges.data ?? []) as T };
      }

      case "create_refund":
        // Action irréversible : refusée au niveau du connecteur, en plus
        // du RBAC. Deux verrous indépendants valent mieux qu'un.
        return {
          ok: false,
          error:
            "Remboursement non implémenté volontairement : action irréversible qui exige " +
            "un chantier dédié et une validation humaine explicite.",
        };

      default:
        return { ok: false, error: `Capacité inconnue : ${capability}` };
    }
  }

  /**
   * Photographie de l'état d'abonnement, dans la forme exacte dont le
   * CFO Brain a besoin. Normalise les intervalles Stripe (annuel →
   * mensuel) pour que le MRR soit comparable.
   */
  async snapshot(): Promise<StripeSnapshot> {
    const active = await this.get<StripeList<StripeSubscription>>(
      "/subscriptions?status=active&limit=100",
    );
    const subscriptions = active.data ?? [];

    const mrrCents = subscriptions.reduce((total, subscription) => {
      for (const item of subscription.items?.data ?? []) {
        const amount = item.price?.unit_amount ?? 0;
        const interval = item.price?.recurring?.interval ?? "month";
        total += interval === "year" ? amount / 12 : interval === "week" ? amount * 4.33 : amount;
      }
      return total;
    }, 0);

    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    const canceled = await this.get<StripeList<StripeSubscription>>(
      `/subscriptions?status=canceled&limit=100&created[gte]=${since}`,
    );
    const canceledCount = (canceled.data ?? []).length;

    // Sur une base trop petite, un taux de résiliation n'a aucun sens
    // statistique : on renvoie null plutôt qu'un pourcentage trompeur.
    const base = subscriptions.length + canceledCount;
    const churn = base >= 10 ? Math.round((canceledCount / base) * 1000) / 10 : null;

    return {
      activeSubscriptions: subscriptions.length,
      mrrEuros: Math.round(mrrCents / 100),
      canceledLast30Days: canceledCount,
      churnRatePercent: churn,
    };
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${STRIPE_API}${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Stripe a répondu ${response.status} : ${body.slice(0, 300)}`);
    }

    return (await response.json()) as T;
  }
}

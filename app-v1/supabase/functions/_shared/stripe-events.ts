/**
 * Événements Stripe → actions métier (fonction PURE, testée). Le crédit du wallet n'a lieu QUE
 * pour `payment_intent.succeeded` : jamais sur une réponse du client, jamais sur `checkout.session.completed`
 * seul (un paiement différé — SEPA, etc. — n'est pas encore encaissé à ce moment-là).
 */
export interface StripeEvent { id: string; type: string; data: { object: Record<string, any> }; livemode?: boolean }

export type PaymentAction =
  | { type: "settle"; paymentId: string; paymentIntent: string; amountCents: number; currency: string; latestCharge: string | null; attemptId: string | null }
  | { type: "fail"; paymentId: string; code: string; detail: string; requiresAction: boolean; attemptId: string | null }
  | { type: "refund"; paymentIntent: string; refundedTotalCents: number }
  | { type: "save_card"; checkoutSessionId: string }
  | { type: "cancel"; paymentId: string }
  | { type: "ignore"; reason: string };

export function planStripeEvent(ev: StripeEvent): PaymentAction[] {
  const o = ev.data.object;
  switch (ev.type) {
    case "payment_intent.succeeded": {
      const m = (o.metadata ?? {}) as Record<string, string>;
      if (!m.payment_id) return [{ type: "ignore", reason: "payment_intent sans payment_id (paiement étranger à l'app)" }];
      if (String(o.currency).toLowerCase() !== "eur") return [{ type: "ignore", reason: `devise inattendue ${o.currency}` }];
      const amount = Number(o.amount_received ?? o.amount);
      if (!Number.isSafeInteger(amount) || amount <= 0) return [{ type: "ignore", reason: "montant invalide" }];
      return [{ type: "settle", paymentId: m.payment_id, paymentIntent: String(o.id), amountCents: amount, currency: "EUR",
        latestCharge: typeof o.latest_charge === "string" ? o.latest_charge : null, attemptId: m.attempt_id ?? null }];
    }
    case "payment_intent.payment_failed": {
      const m = (o.metadata ?? {}) as Record<string, string>;
      if (!m.payment_id) return [{ type: "ignore", reason: "payment_intent sans payment_id" }];
      const err = (o.last_payment_error ?? {}) as Record<string, any>;
      const code = String(err.decline_code ?? err.code ?? "payment_failed");
      const requiresAction = code === "authentication_required" || o.status === "requires_action";
      return [{ type: "fail", paymentId: m.payment_id, code, detail: String(err.message ?? "").slice(0, 500), requiresAction, attemptId: m.attempt_id ?? null }];
    }
    case "payment_intent.canceled": {
      const m = (o.metadata ?? {}) as Record<string, string>;
      return m.payment_id ? [{ type: "cancel", paymentId: m.payment_id }] : [{ type: "ignore", reason: "sans payment_id" }];
    }
    case "checkout.session.async_payment_failed": {
      const m = (o.metadata ?? {}) as Record<string, string>;
      return m.payment_id ? [{ type: "fail", paymentId: m.payment_id, code: "payment_failed", detail: "paiement différé échoué", requiresAction: false, attemptId: null }]
        : [{ type: "ignore", reason: "sans payment_id" }];
    }
    case "checkout.session.expired": {
      const m = (o.metadata ?? {}) as Record<string, string>;
      return m.payment_id ? [{ type: "cancel", paymentId: m.payment_id }] : [{ type: "ignore", reason: "session sans payment_id" }];
    }
    case "checkout.session.completed":
      // Paiement : on attend payment_intent.succeeded. Setup : on enregistre la carte.
      return o.mode === "setup" ? [{ type: "save_card", checkoutSessionId: String(o.id) }] : [{ type: "ignore", reason: "attente de payment_intent.succeeded" }];
    case "charge.refunded": {
      const pi = typeof o.payment_intent === "string" ? o.payment_intent : null;
      if (!pi) return [{ type: "ignore", reason: "charge sans payment_intent" }];
      return [{ type: "refund", paymentIntent: pi, refundedTotalCents: Number(o.amount_refunded ?? 0) }];
    }
    default:
      return [{ type: "ignore", reason: `événement ${ev.type} non géré` }];
  }
}

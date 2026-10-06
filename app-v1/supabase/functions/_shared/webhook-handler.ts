import type { StripeClient } from "./stripe-api.ts";
import { planStripeEvent, type PaymentAction, type StripeEvent } from "./stripe-events.ts";

export interface WebhookDeps {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T>;
  stripe: Pick<StripeClient, "retrieveCharge" | "retrieveCheckoutSession" | "retrievePaymentMethod">;
  /** Lit le montant attendu d'un paiement (source de vérité = notre ligne `payments`, créée avant l'appel Stripe). */
  getPayment(paymentId: string): Promise<{ id: string; amount_cents: number; wallet_id: string; user_id: string | null; status: string } | null>;
  savePaymentMethod(row: { user_id: string; wallet_id: string; provider_pm_id: string; brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null }): Promise<void>;
  getWalletOfUser(userId: string): Promise<string | null>;
  log(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>): void;
}

export interface HandleResult { status: "processed" | "ignored" | "duplicate"; actions: PaymentAction["type"][] }

/**
 * Traite UN événement Stripe, de façon idempotente : déduplication par event.id (svc_webhook_begin),
 * crédit idempotent par paiement (svc_payment_settle). Rejoué 4 fois = 1 seul crédit.
 * Lève en cas d'échec → réponse 500 → Stripe réessaie (et svc_webhook_begin autorise le retraitement).
 */
export async function handleStripeEvent(ev: StripeEvent, d: WebhookDeps): Promise<HandleResult> {
  const fresh = await d.rpc<boolean>("svc_webhook_begin", { p_provider: "stripe", p_event_id: ev.id, p_type: ev.type, p_payload: ev });
  if (!fresh) { d.log("info", "webhook déjà traité", { event: ev.id }); return { status: "duplicate", actions: [] }; }
  try {
    const actions = planStripeEvent(ev);
    let handled = 0;
    for (const a of actions) {
      if (await apply(a, ev, d)) handled++;
    }
    await d.rpc("svc_webhook_end", { p_provider: "stripe", p_event_id: ev.id, p_status: handled > 0 ? "processed" : "ignored" });
    return { status: handled > 0 ? "processed" : "ignored", actions: actions.map((a) => a.type) };
  } catch (e) {
    await d.rpc("svc_webhook_end", { p_provider: "stripe", p_event_id: ev.id, p_status: "failed", p_error: (e as Error).message }).catch(() => undefined);
    throw e;
  }
}

async function apply(a: PaymentAction, ev: StripeEvent, d: WebhookDeps): Promise<boolean> {
  switch (a.type) {
    case "ignore":
      d.log("info", "événement ignoré", { event: ev.id, reason: a.reason });
      return false;

    case "settle": {
      const pay = await d.getPayment(a.paymentId);
      if (!pay) { d.log("error", "paiement inconnu", { event: ev.id, paymentId: a.paymentId }); return false; }
      // Garde-fou : le montant encaissé doit être EXACTEMENT celui qu'on a créé ; sinon on ne crédite pas.
      if (pay.amount_cents !== a.amountCents) {
        d.log("error", "montant encaissé ≠ montant attendu — crédit refusé", { event: ev.id, expected: pay.amount_cents, got: a.amountCents });
        await d.rpc("svc_payment_fail", { p_payment_id: pay.id, p_failure_code: "amount_mismatch", p_detail: `attendu ${pay.amount_cents}, reçu ${a.amountCents}` });
        throw new Error("amount_mismatch");
      }
      let receipt: string | null = null;
      if (a.latestCharge) {
        try { receipt = String((await d.stripe.retrieveCharge(a.latestCharge)).receipt_url ?? "") || null; } catch { /* reçu facultatif */ }
      }
      await d.rpc("svc_payment_link_intent", { p_payment_id: pay.id, p_intent: a.paymentIntent, p_receipt_url: receipt });
      await d.rpc("svc_payment_settle", { p_payment_id: pay.id, p_receipt_url: receipt });
      if (a.attemptId) await d.rpc("svc_auto_reload_finish", { p_attempt_id: a.attemptId, p_status: "succeeded", p_payment_id: pay.id });
      return true;
    }

    case "fail":
      await d.rpc("svc_payment_fail", { p_payment_id: a.paymentId, p_failure_code: a.code, p_detail: a.detail });
      if (a.attemptId) await d.rpc("svc_auto_reload_finish", { p_attempt_id: a.attemptId, p_status: a.requiresAction ? "requires_action" : "failed", p_payment_id: a.paymentId });
      return true;

    case "cancel":
      await d.rpc("svc_payment_cancel", { p_payment_id: a.paymentId });
      return true;

    case "refund": {
      const id = await d.rpc<string | null>("svc_payment_find_by_intent", { p_intent: a.paymentIntent });
      if (!id) { d.log("warn", "remboursement sans paiement connu", { event: ev.id, intent: a.paymentIntent }); return false; }
      const pay = await d.getPayment(id);
      if (!pay) return false;
      await d.rpc("svc_payment_refund_by_id", { p_payment_id: id, p_refunded_total_cents: a.refundedTotalCents });
      return true;
    }

    case "save_card": {
      const s = await d.stripe.retrieveCheckoutSession(a.checkoutSessionId, ["setup_intent.payment_method"]);
      const userId = String(s.metadata?.user_id ?? s.setup_intent?.metadata?.user_id ?? "");
      const pm = s.setup_intent?.payment_method as Record<string, any> | undefined;
      if (!userId || !pm?.id) { d.log("warn", "setup sans utilisateur ou carte", { event: ev.id }); return false; }
      const wallet = await d.getWalletOfUser(userId);
      if (!wallet) return false;
      await d.savePaymentMethod({
        user_id: userId, wallet_id: wallet, provider_pm_id: String(pm.id), brand: pm.card?.brand ?? null,
        last4: pm.card?.last4 ?? null, exp_month: pm.card?.exp_month ?? null, exp_year: pm.card?.exp_year ?? null,
      });
      return true;
    }
  }
}

import { adminClient, env, isCronCaller, json, log, rpcOf } from "../_shared/runtime.ts";
import { createStripeClient, StripeError } from "../_shared/stripe-api.ts";

/**
 * Recharge automatique (web / Stripe) : appelée par l'orchestrateur toutes les ~2 min avec le secret CRON.
 * Garde-fous : une tentative max par heure et par règle (svc_auto_reload_begin), plafond mensuel vérifié dans
 * la sélection (svc_due_auto_reloads), clé d'idempotence Stripe = tentative, 3 échecs ⇒ règle désactivée.
 * Si la banque exige une authentification (SCA) on N'ESSAIE PAS de forcer : on suspend et on prévient l'utilisateur.
 */
Deno.serve(async (req) => {
  if (!isCronCaller(req)) return new Response("forbidden", { status: 403 });
  const sb = adminClient(); const rpc = rpcOf(sb);
  const stripe = createStripeClient({ secretKey: env("STRIPE_SECRET_KEY") });
  const due = await rpc<any[]>("svc_due_auto_reloads");
  const out = { due: due.length, charged: 0, failed: 0, skipped: 0 };

  for (const r of due) {
    const attempt = await rpc<string | null>("svc_auto_reload_begin", { p_rule_id: r.rule_id });
    if (!attempt) { out.skipped++; continue; }
    const paymentId = crypto.randomUUID();
    try {
      const { data: bc } = await sb.from("billing_customers").select("provider_customer_id").eq("user_id", r.user_id).eq("provider", "stripe").maybeSingle();
      if (!bc) throw new StripeError(400, "no_customer", undefined, "client Stripe absent");
      await rpc("svc_payment_upsert", {
        p_provider: "stripe", p_provider_ref: `autoreload:${attempt}`, p_wallet_id: r.wallet_id, p_kind: "auto_reload",
        p_amount_cents: r.amount_cents, p_status: "pending", p_platform: "web", p_metadata: { attempt_id: attempt }, p_id: paymentId,
      });
      const pi = await stripe.createPaymentIntent({
        amount: r.amount_cents, currency: "eur", customer: bc.provider_customer_id, payment_method: r.provider_pm_id,
        off_session: true, confirm: true, description: "Recharge automatique",
        metadata: { payment_id: paymentId, wallet_id: r.wallet_id, user_id: r.user_id, kind: "auto_reload", attempt_id: attempt },
      }, `autoreload:${attempt}`);
      if (pi.status === "succeeded") {
        // Crédit immédiat (idempotent) ; le webhook payment_intent.succeeded ne créditera pas une 2e fois.
        await rpc("svc_payment_link_intent", { p_payment_id: paymentId, p_intent: pi.id });
        await rpc("svc_payment_settle", { p_payment_id: paymentId });
        await rpc("svc_auto_reload_finish", { p_attempt_id: attempt, p_status: "succeeded", p_payment_id: paymentId });
        out.charged++;
      } else {
        const requiresAction = pi.status === "requires_action";
        await rpc("svc_payment_fail", { p_payment_id: paymentId, p_failure_code: requiresAction ? "authentication_required" : `status_${pi.status}`, p_detail: pi.status });
        await rpc("svc_auto_reload_finish", { p_attempt_id: attempt, p_status: requiresAction ? "requires_action" : "failed", p_payment_id: paymentId });
        out.failed++;
      }
    } catch (e) {
      const se = e as StripeError;
      const requiresAction = se.code === "authentication_required";
      await rpc("svc_payment_fail", { p_payment_id: paymentId, p_failure_code: se.declineCode ?? se.code ?? "payment_failed", p_detail: se.message }).catch(() => undefined);
      await rpc("svc_auto_reload_finish", { p_attempt_id: attempt, p_status: requiresAction ? "requires_action" : "failed", p_payment_id: null }).catch(() => undefined);
      log("warn", "recharge automatique échouée", { rule: r.rule_id, code: se.code });
      out.failed++;
    }
  }
  log("info", "auto-reload", out);
  return json(req, out);
});

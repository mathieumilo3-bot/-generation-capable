import { adminClient, env, json, limited, log, preflight, requireUser, rpcOf } from "../_shared/runtime.ts";
import { createStripeClient } from "../_shared/stripe-api.ts";

/**
 * Crée une session Stripe Checkout (page hébergée : carte, Apple Pay, Google Pay, Link… selon l'utilisateur,
 * moyens de paiement dynamiques gérés par Stripe). Le montant est validé ICI (min/max serveur) ; le crédit
 * ne se fait qu'au webhook. Une ligne `payments` « pending » est créée AVANT, pour tracer chaque tentative.
 */
Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json(req, { ok: false, code: "method_not_allowed" }, 405);
  const user = await requireUser(req);
  if (!user) return json(req, { ok: false, code: "not_authenticated" }, 401);

  const sb = adminClient(); const rpc = rpcOf(sb);
  if (!(await limited(sb, `checkout:${user.id}`, 20, 600))) return json(req, { ok: false, code: "rate_limited" }, 429);

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amountCents);
  const idem = String(body.idempotencyKey ?? "");
  const returnUrl = String(body.returnUrl ?? "");
  if (!Number.isSafeInteger(amount) || idem.length < 8) return json(req, { ok: false, code: "invalid_request" }, 400);

  const { data: rows } = await sb.from("app_settings").select("key,value").in("key", ["wallet.min_topup_cents", "wallet.max_topup_cents", "payments.providers"]);
  const set = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
  if (amount < (set["wallet.min_topup_cents"] ?? 1000) || amount > (set["wallet.max_topup_cents"] ?? 100000)) return json(req, { ok: false, code: "amount_too_low" }, 400);

  // Le retour ne peut revenir que vers notre domaine / notre schéma d'app (pas de redirection ouverte).
  const base = env("APP_WEB_URL").replace(/\/$/, "");
  const scheme = env("APP_SCHEME", "montage");
  const okReturn = returnUrl.startsWith(base + "/") || returnUrl.startsWith(`${scheme}://`);
  const back = okReturn ? returnUrl : `${base}/payment-result`;
  const withStatus = (s: string, id: string) => `${back}${back.includes("?") ? "&" : "?"}status=${s}&payment_id=${id}`;

  const [w] = await rpc<any[]>("svc_user_wallet", { p_user_id: user.id });
  if (!w || w.status !== "active" || w.profile_status !== "active") return json(req, { ok: false, code: "wallet_unavailable" }, 403);

  const stripe = createStripeClient({ secretKey: env("STRIPE_SECRET_KEY") });
  try {
    // Client Stripe (créé une fois, réutilisé : permet aussi la recharge automatique).
    let { data: bc } = await sb.from("billing_customers").select("provider_customer_id").eq("user_id", user.id).eq("provider", "stripe").maybeSingle();
    if (!bc) {
      const c = await stripe.createCustomer({ email: user.email, metadata: { user_id: user.id } }, `customer:${user.id}`);
      await sb.from("billing_customers").upsert({ user_id: user.id, provider: "stripe", provider_customer_id: c.id }, { onConflict: "user_id,provider" });
      bc = { provider_customer_id: c.id };
    }

    const paymentId = crypto.randomUUID();
    const session = await stripe.createCheckoutSession({
      mode: "payment",
      customer: bc.provider_customer_id,
      client_reference_id: user.id,
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: amount, product_data: { name: `Recharge de votre solde` } } }],
      success_url: withStatus("success", paymentId), cancel_url: withStatus("cancelled", paymentId),
      metadata: { payment_id: paymentId, wallet_id: w.wallet_id, user_id: user.id, kind: "topup" },
      payment_intent_data: { setup_future_usage: "off_session", metadata: { payment_id: paymentId, wallet_id: w.wallet_id, user_id: user.id, kind: "topup" } },
      payment_method_options: { card: { request_three_d_secure: "automatic" } },
      allow_promotion_codes: false,
    }, `topup:${user.id}:${idem}`);

    // provider_ref = id de session ; le PaymentIntent est lié à l'aboutissement (webhook).
    const pay = await rpc<{ id: string }>("svc_payment_upsert", {
      p_provider: "stripe", p_provider_ref: session.id, p_wallet_id: w.wallet_id, p_kind: "topup", p_amount_cents: amount,
      p_status: "pending", p_platform: "web", p_idempotency_key: idem, p_metadata: { checkout_session: session.id }, p_id: paymentId,
    });
    log("info", "checkout créé", { user: user.id, payment: pay.id, amount });
    return json(req, { ok: true, url: session.url, payment_id: pay.id });
  } catch (e) {
    log("error", "échec création checkout", { user: user.id, error: (e as Error).message });
    return json(req, { ok: false, code: "payment_failed" }, 502);
  }
});

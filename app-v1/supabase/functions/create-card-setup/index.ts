import { adminClient, env, json, limited, log, preflight, requireUser, rpcOf } from "../_shared/runtime.ts";
import { createStripeClient } from "../_shared/stripe-api.ts";

/** Enregistre une carte pour la recharge automatique (Checkout en mode « setup », usage hors session). Web / Stripe uniquement. */
Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json(req, { ok: false, code: "method_not_allowed" }, 405);
  const user = await requireUser(req);
  if (!user) return json(req, { ok: false, code: "not_authenticated" }, 401);
  const sb = adminClient(); const rpc = rpcOf(sb);
  if (!(await limited(sb, `cardsetup:${user.id}`, 10, 600))) return json(req, { ok: false, code: "rate_limited" }, 429);

  const body = await req.json().catch(() => ({}));
  const base = env("APP_WEB_URL").replace(/\/$/, "");
  const scheme = env("APP_SCHEME", "montage");
  const ret = String(body.returnUrl ?? "");
  const back = ret.startsWith(base + "/") || ret.startsWith(`${scheme}://`) ? ret : `${base}/account/auto-reload`;
  const sep = back.includes("?") ? "&" : "?";

  const [w] = await rpc<any[]>("svc_user_wallet", { p_user_id: user.id });
  if (!w || w.status !== "active") return json(req, { ok: false, code: "wallet_unavailable" }, 403);
  const stripe = createStripeClient({ secretKey: env("STRIPE_SECRET_KEY") });
  try {
    let { data: bc } = await sb.from("billing_customers").select("provider_customer_id").eq("user_id", user.id).eq("provider", "stripe").maybeSingle();
    if (!bc) {
      const c = await stripe.createCustomer({ email: user.email, metadata: { user_id: user.id } }, `customer:${user.id}`);
      await sb.from("billing_customers").upsert({ user_id: user.id, provider: "stripe", provider_customer_id: c.id }, { onConflict: "user_id,provider" });
      bc = { provider_customer_id: c.id };
    }
    const session = await stripe.createCheckoutSession({
      mode: "setup", customer: bc.provider_customer_id, currency: "eur", client_reference_id: user.id,
      success_url: `${back}${sep}card=added`, cancel_url: `${back}${sep}card=cancelled`,
      metadata: { user_id: user.id, wallet_id: w.wallet_id },
      setup_intent_data: { metadata: { user_id: user.id, wallet_id: w.wallet_id } },
    }, `cardsetup:${user.id}:${crypto.randomUUID()}`);
    return json(req, { ok: true, url: session.url });
  } catch (e) {
    log("error", "échec setup carte", { user: user.id, error: (e as Error).message });
    return json(req, { ok: false, code: "payment_failed" }, 502);
  }
});

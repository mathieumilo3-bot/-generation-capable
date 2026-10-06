import { adminClient, env, json, log, optEnv, rpcOf } from "../_shared/runtime.ts";
import { verifyStripeSignature } from "../_shared/stripe-signature.ts";
import { createStripeClient } from "../_shared/stripe-api.ts";
import { handleStripeEvent } from "../_shared/webhook-handler.ts";

/**
 * Webhook Stripe : SEULE voie de crédit des paiements web. Signature vérifiée sur le corps brut,
 * déduplication par event.id, crédit idempotent. 200 = traité/ignoré/doublon ; 500 = Stripe réessaie.
 * Aucune authentification Supabase (verify_jwt = false dans config.toml) : la signature fait foi.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const raw = await req.text();
  const ok = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), env("STRIPE_WEBHOOK_SECRET"));
  if (!ok) { log("warn", "signature webhook invalide"); return new Response("invalid signature", { status: 400 }); }

  const sb = adminClient();
  const rpc = rpcOf(sb);
  const stripe = createStripeClient({ secretKey: env("STRIPE_SECRET_KEY"), apiVersion: optEnv("STRIPE_API_VERSION") });
  const event = JSON.parse(raw);
  try {
    const result = await handleStripeEvent(event, {
      rpc, stripe, log,
      getPayment: async (id) => (await sb.from("payments").select("id,amount_cents,wallet_id,user_id,status").eq("id", id).maybeSingle()).data,
      getWalletOfUser: async (uid) => (await sb.from("wallets").select("id").eq("user_id", uid).maybeSingle()).data?.id ?? null,
      savePaymentMethod: async (row) => {
        const { error } = await sb.from("payment_methods").upsert({ ...row, provider: "stripe", is_default: true }, { onConflict: "provider,provider_pm_id" });
        if (error) throw new Error(error.message);
      },
    });
    log("info", "webhook traité", { event: event.id, type: event.type, ...result });
    return json(req, { received: true, ...result });
  } catch (e) {
    log("error", "échec traitement webhook", { event: event.id, type: event.type, error: (e as Error).message });
    return json(req, { received: false }, 500);
  }
});

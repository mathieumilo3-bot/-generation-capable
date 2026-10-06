import { adminClient, env, json, limited, log, optEnv, preflight, requireUser, rpcOf } from "../_shared/runtime.ts";
import { fetchAppleTransaction } from "../_shared/apple.ts";
import { acknowledgeGoogleProduct, fetchGoogleProduct, googleAccessToken } from "../_shared/google.ts";
import { sha256Hex } from "../_shared/crypto.ts";
import { verifyStorePurchase } from "../_shared/store-verify.ts";

/**
 * Achat in-app (consommable) → crédit du wallet après vérification SERVEUR auprès d'Apple / Google.
 * Le client n'envoie jamais un « montant » : seulement l'identifiant du produit et la preuve d'achat.
 */
Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json(req, { ok: false, code: "method_not_allowed" }, 405);
  const user = await requireUser(req);
  if (!user) return json(req, { ok: false, code: "not_authenticated" }, 401);
  const sb = adminClient(); const rpc = rpcOf(sb);
  if (!(await limited(sb, `storeverify:${user.id}`, 30, 600))) return json(req, { ok: false, code: "rate_limited" }, 429);

  const body = await req.json().catch(() => ({}));
  const store = body.store === "apple" ? "apple" : body.store === "google" ? "google" : null;
  if (!store || typeof body.productId !== "string") return json(req, { ok: false, code: "invalid_request" }, 400);

  const [w] = await rpc<any[]>("svc_user_wallet", { p_user_id: user.id });
  if (!w || w.status !== "active") return json(req, { ok: false, code: "wallet_unavailable" }, 403);
  const { data: s } = await sb.from("app_settings").select("value").eq("key", "payments.store_packs").maybeSingle();
  const packs = (s?.value?.[store === "apple" ? "ios" : "android"] ?? []);
  const allowSandbox = optEnv("STORE_ALLOW_SANDBOX") === "true";

  try {
    let googleToken: string | null = null;
    const gsa = optEnv("GOOGLE_SERVICE_ACCOUNT_JSON") ? JSON.parse(env("GOOGLE_SERVICE_ACCOUNT_JSON")) : null;
    const gpkg = optEnv("GOOGLE_PACKAGE_NAME");
    const apple = optEnv("APPLE_IAP_PRIVATE_KEY") ? {
      issuerId: env("APPLE_IAP_ISSUER_ID"), keyId: env("APPLE_IAP_KEY_ID"), bundleId: env("APPLE_BUNDLE_ID"), privateKeyPem: env("APPLE_IAP_PRIVATE_KEY").replace(/\\n/g, "\n"),
    } : null;
    const result = await verifyStorePurchase({
      store, productId: body.productId, transactionId: body.transactionId, purchaseToken: body.purchaseToken,
      userId: user.id, walletId: w.wallet_id, platform: store === "apple" ? "ios" : "android", packs,
    }, {
      rpc, allowSandbox, sha256Hex, appleBundleId: optEnv("APPLE_BUNDLE_ID") ?? "",
      fetchApple: async (id) => { if (!apple) throw new Error("apple_iap_not_configured"); return fetchAppleTransaction(apple, id, { allowSandbox }); },
      fetchGoogle: async (productId, purchaseToken) => {
        if (!gsa || !gpkg) throw new Error("google_play_not_configured");
        googleToken ??= await googleAccessToken(gsa);
        return fetchGoogleProduct({ packageName: gpkg, productId, purchaseToken, accessToken: googleToken });
      },
      acknowledgeGoogle: async (productId, purchaseToken) => {
        googleToken ??= await googleAccessToken(gsa);
        return acknowledgeGoogleProduct({ packageName: gpkg!, productId, purchaseToken, accessToken: googleToken });
      },
    });
    log("info", "achat store vérifié", { user: user.id, store, ok: result.ok, code: result.ok ? undefined : result.code });
    return json(req, result, result.ok ? 200 : 422);
  } catch (e) {
    log("error", "vérification d'achat impossible", { user: user.id, store, error: (e as Error).message });
    return json(req, { ok: false, code: "verification_unavailable" }, 503);   // le client réessaiera (achat non finalisé)
  }
});

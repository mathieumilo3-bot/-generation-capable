import type { AppleTransaction } from "./apple.ts";
import type { GoogleProductPurchase } from "./google.ts";

export interface StorePack { product_id: string; cents: number }

export interface StoreVerifyDeps {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T>;
  fetchApple(transactionId: string): Promise<AppleTransaction | null>;
  fetchGoogle(productId: string, purchaseToken: string): Promise<GoogleProductPurchase | null>;
  acknowledgeGoogle(productId: string, purchaseToken: string): Promise<void>;
  appleBundleId: string;
  allowSandbox: boolean;
  sha256Hex(s: string): Promise<string>;
}

export interface StoreVerifyInput {
  store: "apple" | "google"; productId: string; transactionId?: string; purchaseToken?: string;
  userId: string; walletId: string; platform: "ios" | "android"; packs: StorePack[];
}

export type StoreVerifyResult = { ok: true; credited_cents: number; payment_id: string; replayed: boolean } | { ok: false; code: string };

const eq = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Valide un achat consommable côté serveur puis crédite le wallet de la VALEUR NOMINALE du pack.
 * Garanties : reçu vérifié auprès du store (pas du client), lié à l'utilisateur (appAccountToken /
 * obfuscatedExternalAccountId), rejeu idempotent, un reçu ne peut jamais créditer deux wallets.
 */
export async function verifyStorePurchase(i: StoreVerifyInput, d: StoreVerifyDeps): Promise<StoreVerifyResult> {
  const pack = i.packs.find((p) => p.product_id === i.productId);
  if (!pack) return { ok: false, code: "unknown_product" };

  let providerRef: string;
  let metadata: Record<string, unknown>;

  if (i.store === "apple") {
    if (!i.transactionId) return { ok: false, code: "invalid_receipt" };
    const tx = await d.fetchApple(i.transactionId);
    if (!tx) return { ok: false, code: "invalid_receipt" };
    if (tx.bundleId !== d.appleBundleId || tx.productId !== i.productId) return { ok: false, code: "invalid_receipt" };
    if (tx.revocationDate) return { ok: false, code: "purchase_revoked" };
    if (tx.type !== "Consumable") return { ok: false, code: "invalid_receipt" };
    if (tx.environment === "Sandbox" && !d.allowSandbox) return { ok: false, code: "sandbox_not_allowed" };
    if (!eq(tx.appAccountToken, i.userId)) return { ok: false, code: "purchase_not_bound" };
    providerRef = `apple:${tx.transactionId}`;
    metadata = { product_id: i.productId, environment: tx.environment, original_transaction_id: tx.originalTransactionId };
  } else {
    if (!i.purchaseToken) return { ok: false, code: "invalid_receipt" };
    const p = await d.fetchGoogle(i.productId, i.purchaseToken);
    if (!p || p.purchaseState !== 0) return { ok: false, code: "invalid_receipt" };
    if (p.purchaseType === 0 && !d.allowSandbox) return { ok: false, code: "sandbox_not_allowed" };
    if (!eq(p.obfuscatedExternalAccountId, i.userId)) return { ok: false, code: "purchase_not_bound" };
    providerRef = `google:${p.orderId ?? await d.sha256Hex(i.purchaseToken)}`;
    metadata = { product_id: i.productId, order_id: p.orderId ?? null, test: p.purchaseType === 0 };
  }

  const existing = await d.rpc<{ id: string; wallet_id: string; status: string }[]>("svc_payment_lookup", { p_provider: i.store, p_ref: providerRef });
  const prior = existing[0];
  if (prior && prior.wallet_id !== i.walletId) return { ok: false, code: "purchase_already_used" };

  const pay = await d.rpc<{ id: string }>("svc_payment_upsert", {
    p_provider: i.store, p_provider_ref: providerRef, p_wallet_id: i.walletId, p_kind: "topup", p_amount_cents: pack.cents,
    p_status: "pending", p_platform: i.platform, p_idempotency_key: null, p_metadata: metadata,
  });
  await d.rpc("svc_payment_settle", { p_payment_id: pay.id });
  if (i.store === "google") await d.acknowledgeGoogle(i.productId, i.purchaseToken!).catch(() => undefined);
  return { ok: true, credited_cents: pack.cents, payment_id: pay.id, replayed: !!prior };
}

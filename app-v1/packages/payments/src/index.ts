import type { Platform, PublicSettings } from "@app/config";
import { paymentCapabilities, validateTopupAmount, type PaymentUiCapabilities, type ProviderId } from "@app/domain";

/**
 * Couche PaymentProvider (§26) : le domaine wallet ne dépend d'AUCUN fournisseur.
 * Chaque fournisseur transforme une intention de recharge en résultat normalisé ;
 * le crédit du wallet n'est JAMAIS fait ici : il l'est par le serveur après
 * vérification (webhook Stripe, validation de reçu Apple/Google).
 */
export type TopupResult =
  | { status: "redirect"; url: string }                                   // Stripe Checkout (navigateur)
  | { status: "completed"; creditedCents: number; paymentId: string }     // reçu vérifié par le serveur
  | { status: "pending" }                                                 // en attente de confirmation serveur
  | { status: "cancelled" }
  | { status: "failed"; code: "payment_failed" | "payment_requires_action" | "amount_too_low" | "network_error" | "unsupported" | string };

export interface TopupRequest {
  amountCents: number;
  /** Obligatoire pour les stores : le pack choisi. */
  productId?: string;
  idempotencyKey: string;
  /** Où ramener l'utilisateur après un paiement navigateur (deep link / URL web). */
  returnUrl: string;
}

export interface PaymentProvider {
  readonly id: ProviderId;
  readonly capabilities: PaymentUiCapabilities;
  topup(req: TopupRequest): Promise<TopupResult>;
}

// ── Adaptateurs injectés (le code natif vit dans l'app, pas ici) ─────────
export interface ServerPaymentApi {
  createCheckout(a: { amountCents: number; returnUrl: string; idempotencyKey: string }): Promise<{ ok: true; url: string; payment_id: string } | { ok: false; code: string }>;
  verifyStorePurchase(a: { store: "apple" | "google"; productId: string; transactionId?: string; purchaseToken?: string; signedTransaction?: string }):
    Promise<{ ok: true; credited_cents: number; payment_id: string } | { ok: false; code: string }>;
}

export interface StorePurchase {
  productId: string;
  transactionId?: string;
  purchaseToken?: string;
  signedTransaction?: string;
}

export interface NativeStoreAdapter {
  /** Ouvre la feuille d'achat native. `cancelled` si l'utilisateur ferme. */
  purchase(productId: string): Promise<{ status: "purchased"; purchase: StorePurchase } | { status: "cancelled" } | { status: "failed"; code?: string }>;
  /** À appeler UNIQUEMENT après crédit confirmé par le serveur (consommation / acknowledge / finish). */
  finish(purchase: StorePurchase): Promise<void>;
  /** Achats payés mais non finalisés (crash, coupure) à rejouer au démarrage. */
  pending(): Promise<StorePurchase[]>;
}

export class StripePaymentProvider implements PaymentProvider {
  readonly id = "stripe" as const;
  constructor(readonly capabilities: PaymentUiCapabilities, private api: ServerPaymentApi, private settings: PublicSettings) {}

  async topup(req: TopupRequest): Promise<TopupResult> {
    const v = validateTopupAmount(req.amountCents, this.settings);
    if (v !== "ok") return { status: "failed", code: "amount_too_low" };
    try {
      const res = await this.api.createCheckout({ amountCents: req.amountCents, returnUrl: req.returnUrl, idempotencyKey: req.idempotencyKey });
      return res.ok ? { status: "redirect", url: res.url } : { status: "failed", code: res.code };
    } catch { return { status: "failed", code: "network_error" }; }
  }
}

abstract class StorePaymentProvider implements PaymentProvider {
  abstract readonly id: "apple" | "google";
  constructor(readonly capabilities: PaymentUiCapabilities, protected api: ServerPaymentApi, protected store: NativeStoreAdapter) {}

  private pack(req: TopupRequest) {
    return this.capabilities.packs.find((p) => (req.productId ? p.productId === req.productId : p.cents === req.amountCents));
  }

  async topup(req: TopupRequest): Promise<TopupResult> {
    const pack = this.pack(req);
    if (!pack) return { status: "failed", code: "unsupported" };
    let outcome;
    try { outcome = await this.store.purchase(pack.productId); } catch { return { status: "failed", code: "payment_failed" }; }
    if (outcome.status === "cancelled") return { status: "cancelled" };
    if (outcome.status === "failed") return { status: "failed", code: outcome.code ?? "payment_failed" };
    return this.settle(outcome.purchase);
  }

  /** Vérifie côté serveur PUIS finalise côté store (jamais l'inverse : pas d'argent perdu). */
  async settle(purchase: StorePurchase): Promise<TopupResult> {
    try {
      const res = await this.api.verifyStorePurchase({ store: this.id, ...purchase });
      if (!res.ok) return { status: "failed", code: res.code };
      await this.store.finish(purchase);
      return { status: "completed", creditedCents: res.credited_cents, paymentId: res.payment_id };
    } catch {
      return { status: "pending" };   // réessayé via recoverPending() ; le serveur est idempotent
    }
  }

  /** À lancer au démarrage : rejoue les achats payés mais jamais crédités. */
  async recoverPending(): Promise<TopupResult[]> {
    const out: TopupResult[] = [];
    for (const p of await this.store.pending()) out.push(await this.settle(p));
    return out;
  }
}

export class ApplePaymentProvider extends StorePaymentProvider { readonly id = "apple" as const; }
export class GooglePaymentProvider extends StorePaymentProvider { readonly id = "google" as const; }

export interface ProviderDeps {
  api: ServerPaymentApi;
  /** Requis sur iOS/Android natifs. */
  nativeStore?: NativeStoreAdapter;
}

/** Choisit le fournisseur autorisé pour CE build (matrice serveur `payments.providers`). */
export function createPaymentProvider(platform: Platform, settings: PublicSettings, deps: ProviderDeps): PaymentProvider {
  const caps = paymentCapabilities(platform, settings);
  switch (caps.provider) {
    case "stripe": return new StripePaymentProvider(caps, deps.api, settings);
    case "apple":
      if (!deps.nativeStore) throw new Error("ApplePaymentProvider : adaptateur StoreKit manquant");
      return new ApplePaymentProvider(caps, deps.api, deps.nativeStore);
    case "google":
      if (!deps.nativeStore) throw new Error("GooglePaymentProvider : adaptateur Play Billing manquant");
      return new GooglePaymentProvider(caps, deps.api, deps.nativeStore);
  }
}

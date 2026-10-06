import { Platform } from "react-native";
import type { NativeStoreAdapter, StorePurchase } from "@app/payments";

/**
 * Adaptateur StoreKit (iOS) / Play Billing (Android) au-dessus d'expo-iap.
 *
 *  - `purchase` ouvre la feuille d'achat native et renvoie le reçu à faire vérifier par le SERVEUR ;
 *  - `finish` n'est appelé qu'APRÈS le crédit serveur (finishTransaction, consommable) : un achat payé mais
 *    non crédité reste « en attente » dans le store et sera rejoué par `pending()` ;
 *  - `pending` liste les achats payés mais non finalisés (crash, coupure réseau) pour `recoverPending`.
 *
 * Le module natif n'est chargé que sur iOS/Android (import dynamique) : le web n'en dépend pas.
 * Non testable hors appareil (build de développement + produits App Store Connect / Play Console requis).
 */
type Iap = typeof import("expo-iap");
type IapPurchase = import("expo-iap").Purchase;

let iapPromise: Promise<Iap> | null = null;
const loadIap = () => (iapPromise ??= import("expo-iap"));

let connection: Promise<void> | null = null;
async function connected(): Promise<Iap> {
  const iap = await loadIap();
  connection ??= iap.initConnection().then(() => undefined).catch((e: unknown) => { connection = null; throw e; });
  await connection;
  return iap;
}

/** Reçus bruts déjà vus, par identifiant de transaction : `finishTransaction` a besoin de l'objet d'origine. */
const seen = new Map<string, IapPurchase>();
const keyOf = (p: { id?: string | null; transactionId?: string | null; purchaseToken?: string | null }) => p.transactionId ?? p.id ?? p.purchaseToken ?? "";

function toStorePurchase(p: IapPurchase): StorePurchase {
  const ios = Platform.OS === "ios";
  return {
    productId: p.productId,
    transactionId: keyOf(p) || undefined,
    // iOS : le jeton unifié est la transaction signée (JWS) ; Android : le purchaseToken.
    signedTransaction: ios ? p.purchaseToken ?? undefined : undefined,
    purchaseToken: ios ? undefined : p.purchaseToken ?? undefined,
  };
}

function remember(p: IapPurchase): StorePurchase {
  const sp = toStorePurchase(p);
  seen.set(sp.transactionId ?? sp.purchaseToken ?? sp.signedTransaction ?? "", p);
  return sp;
}

/** Code d'erreur store → code interne (jamais de message technique affiché). */
function errorCode(code: string | undefined): string {
  switch (code) {
    case "network-error": case "service-timeout": case "service-disconnected": return "network_error";
    case "deferred-payment": case "pending": return "purchase_pending";
    case "item-unavailable": case "sku-not-found": return "unsupported";
    default: return "payment_failed";
  }
}

export const nativeStoreAdapter: NativeStoreAdapter = {
  async purchase(productId) {
    let iap: Iap;
    try { iap = await connected(); } catch { return { status: "failed", code: "payment_failed" }; }
    try {
      const products = await iap.fetchProducts({ skus: [productId], type: "in-app" });
      if (!products || products.length === 0) return { status: "failed", code: "unsupported" };
    } catch {
      return { status: "failed", code: "network_error" };
    }
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const subs: { remove: () => void }[] = [];
      let settled = false;
      const done = (r: Awaited<ReturnType<NativeStoreAdapter["purchase"]>>) => {
        if (settled) return;
        settled = true;
        subs.forEach((s) => s.remove());
        resolve(r);
      };
      subs.push(iap.purchaseUpdatedListener((p) => {
        if (p.productId !== productId) return;
        // StoreKit rejoue d'anciennes transactions non finalisées : on ne les prend pas pour l'achat en cours
        // (elles seront créditées par `pending()`).
        if (p.transactionDate && p.transactionDate < startedAt - 60_000) return;
        if (p.purchaseState === "pending") { done({ status: "failed", code: "purchase_pending" }); return; }
        if (p.purchaseState === "purchased") done({ status: "purchased", purchase: remember(p) });
      }));
      subs.push(iap.purchaseErrorListener((e) => {
        if (iap.isUserCancelledError(e)) done({ status: "cancelled" });
        else done({ status: "failed", code: errorCode(e.code) });
      }));
      iap.requestPurchase({ type: "in-app", request: { apple: { sku: productId }, google: { skus: [productId] } } })
        .catch((e: unknown) => {
          if (iap.isUserCancelledError(e)) done({ status: "cancelled" });
          else done({ status: "failed", code: errorCode((e as { code?: string } | null)?.code) });
        });
    });
  },

  async finish(sp) {
    const iap = await connected();
    let raw = seen.get(sp.transactionId ?? sp.purchaseToken ?? sp.signedTransaction ?? "");
    if (!raw) {
      const all = await iap.getAvailablePurchases();
      raw = all.find((p) => keyOf(p) === sp.transactionId || (!!p.purchaseToken && (p.purchaseToken === sp.purchaseToken || p.purchaseToken === sp.signedTransaction)));
    }
    if (!raw) return; // déjà finalisé côté store
    await iap.finishTransaction({ purchase: raw, isConsumable: true });
    seen.delete(sp.transactionId ?? sp.purchaseToken ?? sp.signedTransaction ?? "");
  },

  async pending() {
    try {
      const iap = await connected();
      const all = await iap.getAvailablePurchases();
      return all.filter((p) => p.purchaseState === "purchased").map(remember);
    } catch {
      return [];
    }
  },
};

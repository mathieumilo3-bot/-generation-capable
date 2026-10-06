import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { createPaymentProvider, type PaymentProvider, type TopupResult } from "@app/payments";
import type { PublicSettings } from "@app/config";
import { api } from "@/lib/supabase";
import { isNative, platform } from "@/lib/platform";
import { nativeStoreAdapter } from "@/lib/store-adapter";

/**
 * Fournisseur de paiement de CE build (matrice serveur `payments.providers`). Retourne `null` si le build est
 * mal configuré (ex. fournisseur store sans adaptateur) : l'écran affiche alors « recharge indisponible »,
 * jamais un faux paiement.
 */
export function buildPaymentProvider(settings: PublicSettings): PaymentProvider | null {
  try {
    return createPaymentProvider(platform, settings, { api: api.payments, nativeStore: isNative ? nativeStoreAdapter : undefined });
  } catch {
    return null;
  }
}

/** URL de retour d'un paiement navigateur (le serveur y ajoute `?status=success|cancelled|failed`). */
export function paymentReturnUrl(path = "payment-result"): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/${path}`;
  return Linking.createURL(path);
}

/** Ouvre une page de paiement hébergée : même onglet sur le web, navigateur externe sur mobile (jamais une WebView). */
export async function openHostedPage(url: string): Promise<void> {
  if (Platform.OS === "web" && typeof window !== "undefined") { window.location.assign(url); return; }
  await Linking.openURL(url);
}

/** Achats store payés mais jamais crédités (crash, coupure) : rejoués au démarrage de l'écran wallet. No-op pour Stripe. */
export async function recoverPendingPurchases(provider: PaymentProvider | null): Promise<TopupResult[]> {
  if (!provider) return [];
  const p = provider as PaymentProvider & { recoverPending?: () => Promise<TopupResult[]> };
  if (typeof p.recoverPending !== "function") return [];
  try { return await p.recoverPending(); } catch { return []; }
}

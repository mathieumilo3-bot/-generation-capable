import type { Platform, PublicSettings, ProviderCaps } from "@app/config";

export type ProviderId = ProviderCaps["provider"];

export interface PaymentUiCapabilities {
  provider: ProviderId;
  /** Montant libre ≥ minimum (web/Stripe uniquement). */
  freeAmount: boolean;
  /** Recharge automatique silencieuse (seulement si le fournisseur sait débiter hors session). */
  autoReload: boolean;
  savedCards: boolean;
  /** Packs fixes (stores). */
  packs: { productId: string; cents: number }[];
  /** Sans auto-reload silencieux : on notifie puis on ouvre une recharge native en un geste. */
  lowBalanceNudge: boolean;
}

/**
 * L'UI de recharge s'adapte aux capacités RÉELLES de chaque fournisseur (§27).
 * La matrice vient du serveur (`payments.providers`) → modifiable sans republier,
 * par exemple si les règles d'un store évoluent pour un pays (voir docs/STORE_PAYMENT_POLICY.md).
 */
export function paymentCapabilities(platform: Platform, settings: PublicSettings): PaymentUiCapabilities {
  const caps = settings["payments.providers"][platform];
  const packs = platform === "web" ? [] : settings["payments.store_packs"][platform];
  return {
    provider: caps.provider,
    freeAmount: caps.free_amount,
    autoReload: caps.auto_reload && settings["payments.auto_reload_enabled"],
    savedCards: caps.saved_cards,
    packs: packs.map((p) => ({ productId: p.product_id, cents: p.cents })),
    lowBalanceNudge: !(caps.auto_reload && settings["payments.auto_reload_enabled"]),
  };
}

/** Montants proposés à l'écran de recharge, selon la plateforme. */
export function topupChoices(platform: Platform, settings: PublicSettings): number[] {
  const caps = paymentCapabilities(platform, settings);
  if (caps.packs.length > 0) return caps.packs.map((p) => p.cents).sort((a, b) => a - b);
  return settings["wallet.topup_presets_cents"].filter((c) => c >= settings["wallet.min_topup_cents"]);
}

export function validateTopupAmount(cents: number, settings: PublicSettings): "ok" | "too_low" | "too_high" {
  if (cents < settings["wallet.min_topup_cents"]) return "too_low";
  if (cents > settings["wallet.max_topup_cents"]) return "too_high";
  return "ok";
}

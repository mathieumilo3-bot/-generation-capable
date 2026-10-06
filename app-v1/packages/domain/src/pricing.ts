import type { Cents } from "./money";
import { formatEuros } from "./money";

export type PricingMode = "edit_rushes" | "autonomous" | "revision";

export interface PricingRule {
  id: string;
  mode: PricingMode;
  bucket_key: string;
  label: string;
  duration_min_sec: number;
  duration_max_sec: number;
  price_cents: Cents;
  currency: "EUR";
  active: boolean;
  effective_from: string;
  effective_to: string | null;
  sort_order: number;
  metadata?: Record<string, unknown>;
}

export function isRuleCurrent(rule: PricingRule, now: Date = new Date()): boolean {
  return (
    rule.active &&
    new Date(rule.effective_from) <= now &&
    (rule.effective_to === null || new Date(rule.effective_to) > now)
  );
}

/** Règles en vigueur pour un mode, triées pour l'affichage. Le serveur reste l'autorité. */
export function currentRules(rules: readonly PricingRule[], mode: PricingMode, now: Date = new Date()): PricingRule[] {
  return rules
    .filter((r) => r.mode === mode && isRuleCurrent(r, now))
    .sort((a, b) => a.sort_order - b.sort_order || a.duration_max_sec - b.duration_max_sec);
}

/** La règle couvrant une durée (min exclusif, max inclusif). */
export function ruleForDuration(rules: readonly PricingRule[], mode: PricingMode, seconds: number): PricingRule | undefined {
  return currentRules(rules, mode).find((r) => seconds > r.duration_min_sec && seconds <= r.duration_max_sec);
}

/** Règle de révision en vigueur (une seule). */
export function revisionRule(rules: readonly PricingRule[]): PricingRule | undefined {
  return currentRules(rules, "revision")[0];
}

export interface Quote {
  priceCents: Cents;
  availableCents: Cents;
  afterCents: Cents;
  shortfallCents: Cents;
  canAfford: boolean;
}

/** Calcul d'affichage (le serveur recalcule et fait foi à la soumission). */
export function computeQuote(priceCents: Cents, availableCents: Cents): Quote {
  return {
    priceCents,
    availableCents,
    afterCents: availableCents - priceCents,
    shortfallCents: Math.max(priceCents - availableCents, 0),
    canAfford: availableCents >= priceCents,
  };
}

/**
 * Montant de recharge à proposer pour combler un manque (§58) : le plus petit
 * montant proposé couvrant le manque et respectant le minimum. Au-delà des
 * préréglages, arrondi supérieur à 5 €.
 */
export function suggestTopup(shortfallCents: Cents, minTopupCents: Cents, presetsCents: readonly Cents[]): Cents {
  const floor = Math.max(shortfallCents, minTopupCents);
  const preset = [...presetsCents].sort((a, b) => a - b).find((p) => p >= floor);
  if (preset !== undefined) return preset;
  return Math.ceil(floor / 500) * 500;
}

export function priceLabel(rule: PricingRule): string {
  return `${rule.label} · ${formatEuros(rule.price_cents)}`;
}

/** « 4 montages ≤ 30 s » : valeur perçue d'une recharge (§59). */
export function videosForAmount(amountCents: Cents, rules: readonly PricingRule[], mode: PricingMode = "edit_rushes") {
  return currentRules(rules, mode).map((r) => ({
    rule: r,
    count: r.price_cents > 0 ? Math.floor(amountCents / r.price_cents) : 0,
  }));
}

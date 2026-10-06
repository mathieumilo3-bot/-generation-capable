import { currentRules, formatEuros, relativeDay, validateTopupAmount, parseEurosInput, type Cents, type HistoryItem, type PricingRule } from "@app/domain";
import type { PublicSettings } from "@app/config";
import type { TopupResult } from "@app/payments";

/**
 * Logique pure du wallet et des paiements (sans React ni react-native → testable avec vitest).
 * Rappel : le client ne crédite JAMAIS le solde ; il n'affiche que ce que le serveur a confirmé.
 */

/** Seules les routes internes sont acceptées comme destination de retour (jamais une URL externe). */
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw;
  try { v = decodeURIComponent(raw); } catch { /* valeur déjà décodée */ }
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("://") || v.includes("\\") || /[\r\n]/.test(v)) return null;
  if (v.startsWith("/payment-result")) return null; // évite une boucle de retour
  return v;
}

export type PaymentStatus = "success" | "cancelled" | "failed";

export function parsePaymentStatus(raw: string | null | undefined): PaymentStatus | null {
  return raw === "success" || raw === "cancelled" || raw === "failed" ? raw : null;
}

// ── Résultat d'une tentative de recharge → ce que l'UI doit faire ────────

export type TopupOutcome =
  | { kind: "redirect"; url: string }
  | { kind: "completed"; creditedCents: Cents }
  | { kind: "pending" }
  | { kind: "cancelled" }
  | { kind: "failed"; code: string };

/** Mapping résultat fournisseur → UI. Un achat store « en attente » n'est PAS un échec : il sera crédité à sa validation. */
export function mapTopupResult(r: TopupResult): TopupOutcome {
  switch (r.status) {
    case "redirect": return { kind: "redirect", url: r.url };
    case "completed": return { kind: "completed", creditedCents: r.creditedCents };
    case "pending": return { kind: "pending" };
    case "cancelled": return { kind: "cancelled" };
    case "failed": return r.code === "purchase_pending" ? { kind: "pending" } : { kind: "failed", code: r.code };
  }
}

/** Après une recharge réussie : retour automatique au récapitulatif s'il y en a un, sinon on reste sur le portefeuille. */
export function afterPaymentRoute(outcome: TopupOutcome["kind"] | PaymentStatus, returnTo: string | null | undefined): string | null {
  if (outcome !== "completed" && outcome !== "success") return null;
  return safeReturnTo(returnTo);
}

// ── Montants ────────────────────────────────────────────────────────────

export function topupAmountState(input: string, settings: PublicSettings): { cents: Cents | null; error: string | null } {
  if (input.trim().length === 0) return { cents: null, error: null };
  const cents = parseEurosInput(input);
  if (cents === null) return { cents: null, error: "Saisissez un montant en euros, par exemple 25 ou 25,50." };
  const v = validateTopupAmount(cents, settings);
  if (v === "too_low") return { cents: null, error: `Le minimum de recharge est de ${formatEuros(settings["wallet.min_topup_cents"], { compact: true })}.` };
  if (v === "too_high") return { cents: null, error: `Le maximum par recharge est de ${formatEuros(settings["wallet.max_topup_cents"], { compact: true })}.` };
  return { cents, error: null };
}

/** Montant présélectionné à l'ouverture : celui demandé s'il est proposé (ou valide en montant libre), sinon le plus proche au-dessus. */
export function initialTopupAmount(o: { requested: number | null; choices: readonly Cents[]; freeAmount: boolean; settings: PublicSettings }): { selected: Cents | null; custom: boolean } {
  const sorted = [...o.choices].sort((a, b) => a - b);
  const { requested } = o;
  if (requested !== null && Number.isSafeInteger(requested) && requested > 0) {
    if (sorted.includes(requested)) return { selected: requested, custom: false };
    if (o.freeAmount && validateTopupAmount(requested, o.settings) === "ok") return { selected: requested, custom: true };
    const above = sorted.find((c) => c >= requested);
    if (above !== undefined) return { selected: above, custom: false };
  }
  return { selected: sorted[0] ?? null, custom: false };
}

export function parseAmountParam(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  return n > 0 ? n : null;
}

/** « 4 montages ≤ 30 s » : valeur perçue d'une recharge (§59), calculée sur la plus courte durée tarifée. */
export function perceivedValue(amountCents: Cents, rules: readonly PricingRule[]): string | null {
  const first = currentRules(rules, "edit_rushes")[0];
  if (!first || first.price_cents <= 0) return null;
  const count = Math.floor(amountCents / first.price_cents);
  if (count < 1) return null;
  const max = first.duration_max_sec;
  const dur = max < 60 || max % 60 !== 0 ? `${max} s` : `${max / 60} min`;
  return `${formatEuros(amountCents, { compact: true })} = ${count} ${count > 1 ? "montages" : "montage"} ≤ ${dur}`;
}

// ── Confirmation du crédit (le serveur crédite, le client attend) ───────

export const CONFIRM_TIMEOUT_MS = 30_000;

export type ConfirmState = "confirmed" | "waiting" | "timeout";

export function confirmationState(o: { elapsedMs: number; baselineCents: Cents | null; currentCents: Cents | null; paymentSucceeded: boolean }): ConfirmState {
  const changed = o.baselineCents !== null && o.currentCents !== null && o.currentCents !== o.baselineCents;
  if (o.paymentSucceeded || changed) return "confirmed";
  return o.elapsedMs >= CONFIRM_TIMEOUT_MS ? "timeout" : "waiting";
}

// ── Historique ──────────────────────────────────────────────────────────

export interface HistorySection { label: string; items: HistoryItem[] }

/** Regroupe par jour (« Aujourd'hui », « Hier », date), en conservant l'ordre du plus récent au plus ancien. */
export function groupByDay(items: readonly HistoryItem[], now: Date = new Date()): HistorySection[] {
  const out: HistorySection[] = [];
  for (const it of items) {
    const label = relativeDay(it.createdAt, now);
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(it);
    else out.push({ label, items: [it] });
  }
  return out;
}

// ── Recharge automatique ────────────────────────────────────────────────

export interface AutoReloadForm { thresholdCents: Cents; amountCents: Cents; monthlyCapCents: Cents }

export function validateAutoReload(f: AutoReloadForm, s: PublicSettings): string | null {
  if (f.amountCents < s["wallet.min_topup_cents"]) return `Le montant de chaque recharge doit être d'au moins ${formatEuros(s["wallet.min_topup_cents"], { compact: true })}.`;
  if (f.amountCents > s["wallet.max_topup_cents"]) return `Le montant de chaque recharge ne peut pas dépasser ${formatEuros(s["wallet.max_topup_cents"], { compact: true })}.`;
  if (f.thresholdCents < 0 || f.thresholdCents > 100_000) return "Choisissez un seuil de déclenchement valide.";
  if (f.monthlyCapCents < f.amountCents) return "Le plafond mensuel doit couvrir au moins une recharge.";
  return null;
}

export function autoReloadConsent(f: AutoReloadForm): string {
  return `En activant, vous autorisez une recharge de ${formatEuros(f.amountCents, { compact: true })} lorsque votre solde passe sous ${formatEuros(f.thresholdCents, { compact: true })}, dans la limite de ${formatEuros(f.monthlyCapCents, { compact: true })} par mois. Vous pouvez la désactiver à tout moment.`;
}

// ── Mémorisation d'un paiement navigateur en cours ──────────────────────

export interface PendingTopup { returnTo: string | null; amountCents: Cents | null; baselineCents: Cents | null; startedAt: number }
export const PENDING_TOPUP_KEY = "topup:pending";

export function parsePendingTopup(json: string | null, now: number = Date.now()): PendingTopup | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    const startedAt = typeof v.startedAt === "number" ? v.startedAt : 0;
    if (now - startedAt > 6 * 3600_000) return null; // trop ancien : on l'ignore
    const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
    return { returnTo: safeReturnTo(typeof v.returnTo === "string" ? v.returnTo : null), amountCents: num(v.amountCents), baselineCents: num(v.baselineCents), startedAt };
  } catch {
    return null;
  }
}

// ── Détail d'une ligne d'historique ─────────────────────────────────────

/** Phrase d'explication d'un mouvement (jamais d'identifiant ni de terme technique). */
export function explainLedger(type: string): string {
  switch (type) {
    case "topup": return "Recharge de votre solde.";
    case "hold": return "Montant réservé pour la création de votre vidéo. Il est libéré automatiquement si le rendu échoue définitivement.";
    case "capture": case "purchase": return "Création de votre vidéo.";
    case "release": return "Le montant réservé a été libéré : votre solde est intact.";
    case "refund": return "Remboursement sur votre solde.";
    case "bonus": case "promotion": case "commercial_credit": return "Solde offert, utilisable pour créer vos vidéos.";
    case "manual_adjustment": return "Ajustement effectué par notre équipe.";
    default: return "Mouvement de votre solde.";
  }
}

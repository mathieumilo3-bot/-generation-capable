import { formatEuros, parseEurosInput } from "@app/domain";

export const REASON_MIN = 5;
export const REASON_MAX = 500;
export const NOTE_MAX = 4000;
/** Garde-fou anti-faute de frappe : 50 000 € par opération manuelle. */
export const MAX_AMOUNT_CENTS = 5_000_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/** Code de connexion : exactement 6 chiffres. */
export function normalizeOtp(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

export function isValidOtp(raw: string): boolean {
  return /^\d{6}$/.test(raw);
}

export function validateReason(raw: string): string | null {
  const t = raw.trim();
  if (t.length < REASON_MIN) return `Le motif doit contenir au moins ${REASON_MIN} caractères.`;
  if (t.length > REASON_MAX) return `Le motif est limité à ${REASON_MAX} caractères.`;
  return null;
}

export function validateNote(raw: string): string | null {
  const t = raw.trim();
  if (t.length === 0) return "La note est vide.";
  if (t.length > NOTE_MAX) return `La note est limitée à ${NOTE_MAX} caractères.`;
  return null;
}

export type AmountResult = { ok: true; cents: number } | { ok: false; error: string };

export function parseAmount(
  raw: string,
  opts: { max?: number; allowZero?: boolean; allowEmpty?: boolean } = {},
): AmountResult {
  const max = opts.max ?? MAX_AMOUNT_CENTS;
  if (raw.trim() === "") {
    return opts.allowEmpty ? { ok: true, cents: 0 } : { ok: false, error: "Saisissez un montant en euros." };
  }
  const cents = parseEurosInput(raw);
  if (cents === null) return { ok: false, error: "Montant invalide (ex. 25 ou 25,50 — deux décimales maximum)." };
  if (cents === 0 && !opts.allowZero) return { ok: false, error: "Le montant doit être supérieur à 0 €." };
  if (cents > max) return { ok: false, error: `Montant trop élevé (maximum ${formatEuros(max)}).` };
  return { ok: true, cents };
}

// ── Ajustement de portefeuille ──────────────────────────────────────────
export type AdjustKind = "bonus" | "promotion" | "commercial_credit" | "manual_adjustment";
export type AdjustDirection = "credit" | "debit";

export const ADJUST_KINDS: ReadonlyArray<{ value: AdjustKind; label: string; hint: string }> = [
  { value: "promotion", label: "Montant promotionnel", hint: "Geste commercial ponctuel, ajouté au solde disponible." },
  { value: "bonus", label: "Bonus", hint: "Crédit offert au client, ajouté au solde disponible." },
  { value: "commercial_credit", label: "Crédit commercial", hint: "Solde offert dans le cadre d'un accord commercial." },
  { value: "manual_adjustment", label: "Correction de solde", hint: "Écart à corriger (ajout ou retrait). Tracé dans le ledger et l'audit." },
];

export interface AdjustmentInput {
  kind: AdjustKind;
  direction: AdjustDirection;
  amountInput: string;
  reason: string;
  balanceCents: number;
  heldCents: number;
}

export type AdjustmentResult =
  | { ok: true; kind: AdjustKind; amountCents: number; balanceAfterCents: number; reason: string }
  | { ok: false; errors: { amount?: string; reason?: string } };

export function validateAdjustment(input: AdjustmentInput): AdjustmentResult {
  const errors: { amount?: string; reason?: string } = {};
  const amount = parseAmount(input.amountInput);
  let signed = 0;
  if (!amount.ok) {
    errors.amount = amount.error;
  } else {
    const debit = input.kind === "manual_adjustment" && input.direction === "debit";
    signed = debit ? -amount.cents : amount.cents;
    const available = input.balanceCents - input.heldCents;
    if (debit && amount.cents > available) {
      errors.amount = `Retrait impossible : le solde disponible est de ${formatEuros(Math.max(available, 0))} (le reste est réservé par des montages en cours).`;
    }
  }
  const reasonError = validateReason(input.reason);
  if (reasonError) errors.reason = reasonError;
  if (errors.amount || errors.reason) return { ok: false, errors };
  return {
    ok: true,
    kind: input.kind,
    amountCents: signed,
    balanceAfterCents: input.balanceCents + signed,
    reason: input.reason.trim(),
  };
}

export function describeAdjustment(kind: AdjustKind, amountCents: number): string {
  const abs = formatEuros(Math.abs(amountCents));
  switch (kind) {
    case "promotion": return `Ajouter ${abs} de montant promotionnel`;
    case "bonus": return `Ajouter ${abs} de bonus`;
    case "commercial_credit": return `Ajouter ${abs} de crédit commercial`;
    case "manual_adjustment":
      return amountCents < 0 ? `Retirer ${abs} (correction de solde)` : `Ajouter ${abs} (correction de solde)`;
  }
}

// ── Création client / vente directe ─────────────────────────────────────
export interface InvitationFormValues {
  clientName: string;
  email: string;
  company: string;
  source: string;
  campaign: string;
  salesperson: string;
  dealRef: string;
  paid: string;
  gifted: string;
  notes: string;
  expiresDays: string;
}

export const EMPTY_INVITATION_FORM: InvitationFormValues = {
  clientName: "", email: "", company: "", source: "", campaign: "", salesperson: "",
  dealRef: "", paid: "", gifted: "", notes: "", expiresDays: "14",
};

export interface InvitationPayload {
  clientName: string;
  email: string;
  company: string | null;
  sourceName: string | null;
  campaign: string | null;
  salesperson: string | null;
  dealRef: string | null;
  paidCents: number;
  giftedCents: number;
  notes: string | null;
  expiresDays: number;
}

export type InvitationFormErrors = Partial<Record<keyof InvitationFormValues, string>>;
export type InvitationFormResult =
  | { ok: true; payload: InvitationPayload; totalCreditCents: number }
  | { ok: false; errors: InvitationFormErrors };

function blankToNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

export function validateInvitationForm(v: InvitationFormValues): InvitationFormResult {
  const errors: InvitationFormErrors = {};
  const name = v.clientName.trim();
  if (name === "") errors.clientName = "Le nom est obligatoire.";
  else if (name.length > 120) errors.clientName = "120 caractères maximum.";

  const email = v.email.trim().toLowerCase();
  if (email === "") errors.email = "L'e-mail est obligatoire (il identifie le client dans le deal).";
  else if (!isEmail(email)) errors.email = "Adresse e-mail invalide.";

  if (v.company.trim().length > 120) errors.company = "120 caractères maximum.";
  if (v.source.trim().length > 120) errors.source = "120 caractères maximum.";
  if (v.campaign.trim().length > 120) errors.campaign = "120 caractères maximum.";
  if (v.salesperson.trim().length > 120) errors.salesperson = "120 caractères maximum.";
  if ((v.campaign.trim() !== "" || v.salesperson.trim() !== "") && v.source.trim() === "") {
    errors.source = "Indiquez la source pour renseigner une campagne ou un commercial.";
  }
  const dealRef = v.dealRef.trim();
  if (dealRef !== "" && !/^[A-Za-z0-9][A-Za-z0-9._\-/ ]{0,79}$/.test(dealRef)) {
    errors.dealRef = "Identifiant invalide (lettres, chiffres, . _ - / ; 80 caractères maximum).";
  }
  const paid = parseAmount(v.paid, { allowEmpty: true, allowZero: true });
  if (!paid.ok) errors.paid = paid.error;
  const gifted = parseAmount(v.gifted, { allowEmpty: true, allowZero: true });
  if (!gifted.ok) errors.gifted = gifted.error;
  if (v.notes.length > 2000) errors.notes = "2 000 caractères maximum.";
  const days = Number(v.expiresDays);
  if (!/^\d+$/.test(v.expiresDays.trim()) || !Number.isInteger(days) || days < 1 || days > 90) {
    errors.expiresDays = "Entre 1 et 90 jours.";
  }

  if (Object.keys(errors).length > 0 || !paid.ok || !gifted.ok) return { ok: false, errors };
  return {
    ok: true,
    totalCreditCents: paid.cents + gifted.cents,
    payload: {
      clientName: name,
      email,
      company: blankToNull(v.company),
      sourceName: blankToNull(v.source),
      campaign: blankToNull(v.campaign),
      salesperson: blankToNull(v.salesperson),
      dealRef: blankToNull(dealRef),
      paidCents: paid.cents,
      giftedCents: gifted.cents,
      notes: blankToNull(v.notes),
      expiresDays: days,
    },
  };
}

/** `${publicAppUrl}/invite/${token}` — null si l'URL publique n'est pas configurée ou invalide. */
export function buildInviteLink(publicAppUrl: string | undefined, token: string): string | null {
  if (!publicAppUrl) return null;
  try {
    const u = new URL(publicAppUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}/invite/${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}

// ── Tarifs ──────────────────────────────────────────────────────────────
export type PriceChangeResult =
  | { ok: true; cents: number; warning: string | null }
  | { ok: false; error: string };

/** 1 000 € : un prix de vidéo au-delà est quasi sûrement une faute de saisie. */
export const MAX_PRICE_CENTS = 100_000;

export function validatePriceChange(currentCents: number, raw: string): PriceChangeResult {
  const parsed = parseAmount(raw, { allowZero: true, max: MAX_PRICE_CENTS });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.cents === currentCents) return { ok: false, error: "Le nouveau prix est identique au prix actuel." };
  let warning: string | null = null;
  if (parsed.cents === 0) {
    warning = "Le prix passe à 0 € : les vidéos de cette tranche deviendraient gratuites.";
  } else if (currentCents > 0 && (parsed.cents * 2 < currentCents || parsed.cents > currentCents * 2)) {
    warning = `Variation supérieure à 100 % (${formatEuros(currentCents)} → ${formatEuros(parsed.cents)}). Vérifiez qu'il ne s'agit pas d'une faute de frappe.`;
  }
  return { ok: true, cents: parsed.cents, warning };
}

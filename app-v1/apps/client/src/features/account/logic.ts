import type { BillingDetails } from "@app/api";

/** Logique pure de la zone Compte (sans React ni react-native → testable avec vitest). */

export const DELETE_PHRASE = "SUPPRIMER";

export function isDeleteConfirmed(input: string): boolean {
  return input.trim() === DELETE_PHRASE;
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function isValidOtp(v: string): boolean {
  return /^\d{6}$/.test(v.trim());
}

export function initials(p: { first_name?: string | null; last_name?: string | null; email?: string | null }): string {
  const a = p.first_name?.trim()[0] ?? "";
  const b = p.last_name?.trim()[0] ?? "";
  const s = `${a}${b}`.toUpperCase();
  if (s) return s;
  return (p.email?.trim()[0] ?? "?").toUpperCase();
}

export function displayName(p: { first_name?: string | null; last_name?: string | null; email?: string | null }): string {
  const n = [p.first_name?.trim(), p.last_name?.trim()].filter(Boolean).join(" ");
  return n || p.email || "Mon compte";
}

// ── Facturation ─────────────────────────────────────────────────────────

export type BillingForm = Required<Record<keyof BillingDetails, string>>;

export function toBillingForm(b: BillingDetails | null | undefined): BillingForm {
  return { name: b?.name ?? "", company: b?.company ?? "", address: b?.address ?? "", postal_code: b?.postal_code ?? "", city: b?.city ?? "", country: b?.country ?? "", vat_number: b?.vat_number ?? "", email: b?.email ?? "" };
}

/** Valeurs nettoyées ; les champs vides sont retirés. Aucune règle fiscale n'est appliquée ici. */
export function normalizeBilling(f: BillingForm): BillingDetails {
  const out: BillingDetails = {};
  for (const k of Object.keys(f) as (keyof BillingForm)[]) {
    const v = f[k].trim();
    if (v) out[k] = k === "vat_number" ? v.toUpperCase().replace(/\s+/g, " ") : v;
  }
  return out;
}

export function validateBilling(f: BillingForm): Partial<Record<keyof BillingForm, string>> {
  const errors: Partial<Record<keyof BillingForm, string>> = {};
  if (f.email.trim() && !isValidEmail(f.email)) errors.email = "Cette adresse e-mail ne semble pas valide.";
  if (f.postal_code.trim().length > 12) errors.postal_code = "Ce code postal semble trop long.";
  if (f.vat_number.trim().length > 20) errors.vat_number = "Ce numéro de TVA semble trop long.";
  return errors;
}

export function sameBilling(a: BillingDetails, b: BillingDetails): boolean {
  return JSON.stringify(normalizeBilling(toBillingForm(a))) === JSON.stringify(normalizeBilling(toBillingForm(b)));
}

// ── Aide ────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Contexte joint automatiquement à « Signaler un problème » (paramètres de route, jamais saisis). */
export function supportContext(p: Record<string, string | string[] | undefined>): { projectId?: string; jobId?: string; versionId?: string } {
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const raw = p[k];
      const v = Array.isArray(raw) ? raw[0] : raw;
      if (v && UUID.test(v)) return v;
    }
    return undefined;
  };
  return { projectId: pick("project_id", "projectId"), jobId: pick("job_id", "jobId"), versionId: pick("version_id", "versionId") };
}

export type SupportCategory = "video_problem" | "payment" | "account" | "other";
export const SUPPORT_CATEGORIES: { key: SupportCategory; label: string }[] = [
  { key: "video_problem", label: "Une vidéo" },
  { key: "payment", label: "Un paiement" },
  { key: "account", label: "Mon compte" },
  { key: "other", label: "Autre chose" },
];

export function canSendSupport(message: string): boolean {
  return message.trim().length >= 10;
}

// ── Invitation ──────────────────────────────────────────────────────────

/** Même forme de jeton que `parseDeepLink` (liens d'invitation). */
export function isValidInviteToken(t: string | undefined | null): t is string {
  return !!t && /^[A-Za-z0-9_-]{20,128}$/.test(t);
}

export type InvitePreview =
  | { kind: "invalid" }
  | { kind: "credit"; creditCents: number; firstName: string | null }
  | { kind: "team"; company: string | null; firstName: string | null }
  | { kind: "plain"; firstName: string | null };

export function describeInvitation(peek: { valid: boolean; kind?: string; credit_cents?: number; name?: string; company?: string | null }): InvitePreview {
  if (!peek.valid) return { kind: "invalid" };
  const firstName = peek.name?.trim() ? peek.name.trim() : null;
  if (peek.kind === "organization") return { kind: "team", company: peek.company ?? null, firstName };
  if (typeof peek.credit_cents === "number" && peek.credit_cents > 0) return { kind: "credit", creditCents: peek.credit_cents, firstName };
  return { kind: "plain", firstName };
}

// ── Suppression de compte ───────────────────────────────────────────────

export type DeleteFailure = "reauth" | "blocked" | "error";

/** Que faire d'un refus du serveur ? `reauth_required` → code par e-mail ; `transfer_ownership_first` → bloqué. */
export function classifyDeleteFailure(code: string | undefined | null): DeleteFailure {
  if (code === "reauth_required") return "reauth";
  if (code === "transfer_ownership_first") return "blocked";
  return "error";
}

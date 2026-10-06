import { formatEuros } from "@app/domain";

/**
 * Erreurs du back-office : un code stable + un message français lisible.
 * Les messages SQL bruts ne sont jamais affichés tels quels.
 */
export class AdminError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? humanizeAdminCode(code));
    this.name = "AdminError";
    this.code = code;
  }
}

const KNOWN_CODES = [
  "forbidden", "not_authenticated", "reason_required", "invalid_amount", "invalid_kind", "invalid_status",
  "idempotency_key_required", "idempotency_key_reused_with_different_payload", "wallet_not_found", "wallet_closed",
  "adjustment_below_held", "job_not_found", "user_not_found", "rule_not_found", "unknown_setting",
  "client_name_required", "rate_limited", "nothing_to_refund", "not_retryable", "job_in_progress",
  "already_captured", "insufficient_funds", "wallet_frozen", "hold_underflow",
] as const;

/** Extrait un code stable d'une erreur PostgREST/Supabase/réseau. */
export function codeFromError(err: unknown): string {
  if (err instanceof AdminError) return err.code;
  if (typeof err === "string") return err;
  if (typeof err !== "object" || err === null) return "unknown";
  const e = err as { message?: unknown; code?: unknown; status?: unknown; name?: unknown };
  const msg = typeof e.message === "string" ? e.message : "";
  for (const k of KNOWN_CODES) if (msg.includes(k)) return k;
  if (e.code === "42501") return "forbidden";
  if (e.status === 401 || msg.includes("JWT")) return "not_authenticated";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) return "network_error";
  return "unknown";
}

export function humanizeAdminCode(code: string, ctx: { shortfallCents?: number } = {}): string {
  switch (code) {
    case "forbidden": return "Action refusée : votre rôle ne permet pas cette opération.";
    case "not_authenticated": return "Votre session a expiré. Reconnectez-vous.";
    case "reason_required": return "Un motif d'au moins 5 caractères est obligatoire.";
    case "invalid_amount": return "Montant invalide.";
    case "invalid_kind": return "Type d'opération invalide.";
    case "invalid_status": return "Statut invalide.";
    case "idempotency_key_required": return "Clé d'idempotence manquante : rouvrez la fenêtre et réessayez.";
    case "idempotency_key_reused_with_different_payload":
      return "Cette opération a déjà été enregistrée avec un autre montant. Vérifiez l'historique du client avant de réessayer.";
    case "wallet_not_found": return "Portefeuille introuvable.";
    case "wallet_closed": return "Ce portefeuille est clos : aucune opération n'est possible.";
    case "wallet_frozen": return "Ce portefeuille est gelé (compte suspendu).";
    case "adjustment_below_held": return "Le retrait dépasserait le solde : une partie est réservée par un montage en cours.";
    case "job_not_found": return "Job introuvable.";
    case "user_not_found": return "Client introuvable.";
    case "rule_not_found": return "Règle tarifaire introuvable.";
    case "unknown_setting": return "Réglage inconnu : la clé n'existe pas.";
    case "client_name_required": return "Le nom du client est obligatoire.";
    case "rate_limited": return "Trop d'opérations en peu de temps. Patientez avant de réessayer.";
    case "nothing_to_refund": return "Rien à rembourser : le montant de ce job n'a pas été encaissé (ou a déjà été rendu).";
    case "not_retryable": return "Seul un job en échec peut être relancé.";
    case "job_in_progress": return "Un autre job est déjà en cours sur ce projet.";
    case "already_captured": return "Le montant de ce job a déjà été encaissé : relance impossible sans remboursement.";
    case "insufficient_funds":
      return ctx.shortfallCents !== undefined
        ? `Solde du client insuffisant pour réserver à nouveau le montant : il manque ${formatEuros(ctx.shortfallCents)}.`
        : "Solde du client insuffisant pour réserver à nouveau le montant.";
    case "network_error": return "Connexion impossible. Vérifiez votre réseau et réessayez.";
    default: return "Une erreur inattendue est survenue. Réessayez ; si cela continue, consultez le journal d'audit.";
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof AdminError) return err.message;
  return humanizeAdminCode(codeFromError(err));
}

/**
 * Supabase répond par une erreur quand l'e-mail n'est pas connu (shouldCreateUser:false).
 * On ne le révèle pas : le formulaire passe quand même à l'étape « code ».
 */
export function isUnknownUserOtpError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { message?: unknown; code?: unknown; status?: unknown };
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return (
    e.code === "otp_disabled" ||
    e.code === "user_not_found" ||
    msg.includes("signups not allowed") ||
    msg.includes("user not found") ||
    msg.includes("not allowed for otp")
  );
}

export function otpErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as { message?: unknown; code?: unknown; status?: unknown };
    const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
    if (e.status === 429 || e.code === "over_email_send_rate_limit" || msg.includes("rate limit") || msg.includes("seconds")) {
      return "Trop de demandes. Patientez une minute avant de redemander un code.";
    }
    if (e.code === "otp_expired" || msg.includes("expired")) return "Ce code a expiré. Demandez-en un nouveau.";
    if (msg.includes("invalid") || e.code === "invalid_credentials") return "Code incorrect. Vérifiez les 6 chiffres.";
  }
  return humanizeAdminCode(codeFromError(err));
}

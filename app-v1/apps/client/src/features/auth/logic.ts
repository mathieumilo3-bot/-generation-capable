import { errorCodeOf, humanizeError } from "@app/domain";

/** Logique pure de connexion (testable sans React Native). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  const e = normalizeEmail(input);
  return e.length <= 254 && EMAIL_RE.test(e);
}

export const OTP_LENGTH = 6;

/** Ne garde que les chiffres (collage « 123 456 », saisie, remplissage automatique). */
export function sanitizeOtp(input: string): string {
  return input.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export function isOtpComplete(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export const RESEND_DELAY_SEC = 30;

/** Secondes restantes avant de pouvoir redemander un code (0 = disponible). */
export function resendSecondsLeft(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Renvoyer le code dans ${secondsLeft} s` : "Renvoyer le code";
}

export interface AuthCallbackParams {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  errorDescription?: string;
}

function parseParams(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split("&")) {
    if (!part) continue;
    const i = part.indexOf("=");
    const k = decodeURIComponent((i < 0 ? part : part.slice(0, i)).replace(/\+/g, " "));
    const v = i < 0 ? "" : decodeURIComponent(part.slice(i + 1).replace(/\+/g, " "));
    out[k] = v;
  }
  return out;
}

/**
 * Extrait les paramètres d'un retour d'authentification : PKCE (`?code=`), jetons (`#access_token=`)
 * ou erreur — dans la query ET/OU le fragment, pour les liens web, natifs et Universal Links.
 */
export function parseAuthCallbackUrl(url: string): AuthCallbackParams {
  const hashAt = url.indexOf("#");
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const hash = hashAt >= 0 ? url.slice(hashAt + 1) : "";
  const qAt = beforeHash.indexOf("?");
  const query = qAt >= 0 ? beforeHash.slice(qAt + 1) : "";
  let all: Record<string, string> = {};
  try { all = { ...parseParams(query), ...parseParams(hash.startsWith("?") ? hash.slice(1) : hash) }; } catch { return {}; }
  return {
    code: all.code || undefined,
    accessToken: all.access_token || undefined,
    refreshToken: all.refresh_token || undefined,
    error: all.error_code || all.error || undefined,
    errorDescription: all.error_description || undefined,
  };
}

export function hasCallbackPayload(p: AuthCallbackParams): boolean {
  return !!(p.code || (p.accessToken && p.refreshToken) || p.error);
}

/** Premier accès = `created_at` ≈ `last_sign_in_at` (Supabase les fixe au même instant à l'inscription). */
export function isNewUser(createdAt: string | undefined | null, lastSignInAt: string | undefined | null, toleranceMs = 60_000): boolean {
  if (!createdAt || !lastSignInAt) return false;
  const a = Date.parse(createdAt);
  const b = Date.parse(lastSignInAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(b - a) <= toleranceMs;
}

export type AuthErrorKind = "otp_invalid" | "rate_limited" | "invalid_email" | "network" | "cancelled" | "other";

export function authErrorKind(err: unknown): AuthErrorKind {
  const e = (err ?? {}) as { code?: unknown; message?: unknown; name?: unknown };
  const hay = `${typeof e.code === "string" ? e.code : ""} ${typeof e.message === "string" ? e.message : ""} ${typeof e.name === "string" ? e.name : ""}`.toLowerCase();
  if (/err_request_canceled|user_cancel|cancell?ed|access_denied/.test(hay)) return "cancelled";
  if (/otp_expired|otp_invalid|invalid_otp|token has expired|invalid token|token is invalid/.test(hay)) return "otp_invalid";
  if (/rate_limit|rate limit|too many|over_email_send/.test(hay)) return "rate_limited";
  if (/email_address_invalid|invalid.*email|unable to validate email/.test(hay)) return "invalid_email";
  if (/network|failed to fetch|offline|timeout/.test(hay)) return "network";
  return "other";
}

/** Message humain (jamais le texte brut du serveur). */
export function describeAuthError(err: unknown): { title: string; detail: string } {
  switch (authErrorKind(err)) {
    case "otp_invalid":
      return { title: "Ce code n'est pas valide.", detail: "Vérifiez les 6 chiffres ou demandez un nouveau code." };
    case "invalid_email":
      return { title: "Cette adresse e-mail semble incorrecte.", detail: "Vérifiez-la et réessayez." };
    case "rate_limited": {
      const h = humanizeError("rate_limited");
      return { title: h.title, detail: h.detail };
    }
    case "network": {
      const h = humanizeError("offline");
      return { title: h.title, detail: "Reconnectez-vous à Internet puis réessayez." };
    }
    case "cancelled":
      return { title: "Connexion annulée.", detail: "Vous pouvez réessayer quand vous voulez." };
    default: {
      const h = humanizeError(errorCodeOf(err) === "unknown" ? "unknown" : errorCodeOf(err));
      return { title: "La connexion n'a pas abouti.", detail: h.detail };
    }
  }
}

/** Nom de profil à enregistrer depuis Apple (fourni une seule fois, à la première connexion). */
export function appleFirstName(fullName: { givenName?: string | null } | null | undefined): string | null {
  const g = fullName?.givenName?.trim();
  return g ? g : null;
}

export const bytesToHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

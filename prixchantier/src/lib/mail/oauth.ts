import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/** OAuth 2.0 (code + PKCE) pour Gmail et Microsoft 365. Tout se passe côté serveur. */

export type OAuthProvider = "google" | "microsoft";

export const OAUTH_COOKIE = "pc_mail_oauth";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];
export const MICROSOFT_SCOPES = ["offline_access", "openid", "email", "User.Read", "Mail.ReadWrite", "Mail.Send"];

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope: string;
};

export class OAuthError extends Error {
  constructor(
    message: string,
    public invalidGrant = false,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

export function redirectUri(provider: OAuthProvider) {
  return `${env().APP_URL}/api/mail/${provider}/callback`;
}

export function newPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomBytes(24).toString("base64url") };
}

export function authorizationUrl(provider: OAuthProvider, state: string, challenge: string, loginHint?: string) {
  const e = env();
  if (provider === "google") {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({
      client_id: e.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri("google"),
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      ...(loginHint ? { login_hint: loginHint } : {}),
    }).toString();
    return u.toString();
  }
  const u = new URL(`https://login.microsoftonline.com/${e.MICROSOFT_TENANT}/oauth2/v2.0/authorize`);
  u.search = new URLSearchParams({
    client_id: e.MICROSOFT_CLIENT_ID!,
    redirect_uri: redirectUri("microsoft"),
    response_type: "code",
    response_mode: "query",
    scope: MICROSOFT_SCOPES.join(" "),
    prompt: "select_account",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(loginHint ? { login_hint: loginHint } : {}),
  }).toString();
  return u.toString();
}

async function tokenRequest(provider: OAuthProvider, params: Record<string, string>): Promise<TokenSet> {
  const e = env();
  const url =
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : `https://login.microsoftonline.com/${e.MICROSOFT_TENANT}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: provider === "google" ? e.GOOGLE_CLIENT_ID! : e.MICROSOFT_CLIENT_ID!,
    client_secret: provider === "google" ? e.GOOGLE_CLIENT_SECRET! : e.MICROSOFT_CLIENT_SECRET!,
    ...(provider === "microsoft" ? { scope: MICROSOFT_SCOPES.join(" ") } : {}),
    ...params,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = String(json.error ?? res.status);
    throw new OAuthError(`Échec OAuth ${provider} (${code})`, code === "invalid_grant");
  }
  return {
    accessToken: String(json.access_token),
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresAt: new Date(Date.now() + Number(json.expires_in ?? 3600) * 1000),
    scope: String(json.scope ?? ""),
  };
}

export function exchangeCode(provider: OAuthProvider, code: string, verifier: string) {
  return tokenRequest(provider, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(provider),
    code_verifier: verifier,
  });
}

export function refreshTokens(provider: OAuthProvider, refreshToken: string) {
  return tokenRequest(provider, { grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Adresse de la boîte réellement autorisée (source faisant foi : l'API mail). */
export async function mailboxIdentity(provider: OAuthProvider, accessToken: string): Promise<{ email: string; name: string | null }> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (provider === "google") {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new OAuthError("Impossible de lire le profil Gmail");
    const json = (await res.json()) as { emailAddress: string };
    return { email: json.emailAddress.toLowerCase(), name: null };
  }
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName", {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new OAuthError("Impossible de lire le profil Microsoft");
  const json = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
  return { email: (json.mail || json.userPrincipalName || "").toLowerCase(), name: json.displayName ?? null };
}

export function hasRequiredScopes(provider: OAuthProvider, scope: string) {
  if (provider === "google") {
    return GOOGLE_SCOPES.filter((s) => s.startsWith("https://")).every((s) => scope.includes(s));
  }
  const granted = scope.toLowerCase();
  return ["mail.readwrite", "mail.send"].every((s) => granted.includes(s));
}

/** Révocation côté Google ; Microsoft n'expose pas de révocation par token (suppression locale). */
export async function revokeToken(provider: OAuthProvider, token: string) {
  if (provider !== "google") return;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => undefined);
}

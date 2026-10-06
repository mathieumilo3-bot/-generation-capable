import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import type { Session, User } from "@supabase/supabase-js";
import { api } from "@/lib/supabase";
import { analytics } from "@/lib/analytics";
import { appleFirstName, isNewUser, parseAuthCallbackUrl } from "./logic";

// Ferme la fenêtre d'authentification ouverte par le web (retour popup) ; sans effet ailleurs.
WebBrowser.maybeCompleteAuthSession();

export type Provider = "apple" | "google";

export type SocialResult =
  | { status: "signedIn"; session: Session }
  | { status: "cancelled" }
  | { status: "redirecting" };

/** URL de retour (schéma natif, ou origine web) à déclarer dans les URL de redirection autorisées du projet d'authentification. */
export const authRedirectUrl = (): string => Linking.createURL("auth/callback");

/** Apple impose son bouton natif sur iOS ; ailleurs, on passe par le navigateur. */
export async function isNativeAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try { return await AppleAuthentication.isAvailableAsync(); } catch { return false; }
}

/** Mesure « nouvel utilisateur » : signup_completed (login_completed est émis par AuthProvider à chaque connexion). */
export function trackSignInSuccess(user: User | null | undefined, provider: string): void {
  if (user && isNewUser(user.created_at, user.last_sign_in_at)) analytics.track("signup_completed", { provider });
}

/** Appel « best effort » : ne bloque jamais la connexion (jeton Apple conservé côté serveur pour pouvoir le révoquer à la suppression du compte). */
async function linkAppleBestEffort(input: { authorizationCode?: string; refreshToken?: string }): Promise<void> {
  if (!input.authorizationCode && !input.refreshToken) return;
  try { await api.account.linkAppleAuth(input); } catch (e) {
    console.warn("[auth] liaison Apple impossible", (e as { code?: string } | null)?.code ?? "unknown");
  }
}

async function saveNameBestEffort(firstName: string | null): Promise<void> {
  if (!firstName) return;
  try { await api.account.updateProfile({ first_name: firstName }); } catch { /* le prénom est facultatif */ }
}

async function signInWithAppleNative(): Promise<SocialResult> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "ERR_REQUEST_CANCELED") return { status: "cancelled" };
    throw e;
  }
  if (!credential.identityToken) throw Object.assign(new Error("apple_no_identity_token"), { code: "unknown" });
  const session = await api.auth.signInWithAppleIdToken(credential.identityToken, rawNonce);
  if (!session) throw Object.assign(new Error("no_session"), { code: "unknown" });
  await Promise.all([
    saveNameBestEffort(appleFirstName(credential.fullName)),
    linkAppleBestEffort({ authorizationCode: credential.authorizationCode ?? undefined }),
  ]);
  trackSignInSuccess(session.user, "apple");
  return { status: "signedIn", session };
}

/**
 * Termine un retour d'authentification à partir de l'URL reçue (PKCE `code`, ou jetons).
 * Sur le web, supabase-js échange déjà le `code` au démarrage (detectSessionInUrl) : on regarde d'abord
 * la session pour ne jamais consommer deux fois le même code.
 */
export async function completeAuthFromUrl(url: string): Promise<Session> {
  const p = parseAuthCallbackUrl(url);
  if (p.error) throw Object.assign(new Error(p.error), { code: p.error });
  if (p.code) {
    const existing = await api.auth.getSession();
    if (existing) return existing;
    const session = await api.auth.exchangeCode(p.code);
    if (session) return session;
  } else if (p.accessToken && p.refreshToken) {
    const session = await api.auth.setSessionFromTokens(p.accessToken, p.refreshToken);
    if (session) return session;
  }
  throw Object.assign(new Error("callback_invalid"), { code: "unknown" });
}

/** Après un retour OAuth : mesure + liaison Apple si le fournisseur a renvoyé un jeton de rafraîchissement. */
export async function finalizeOAuthSession(session: Session): Promise<void> {
  const provider = String(session.user.app_metadata?.provider ?? "oauth");
  trackSignInSuccess(session.user, provider);
  if (provider === "apple" && session.provider_refresh_token) {
    await linkAppleBestEffort({ refreshToken: session.provider_refresh_token });
  }
}

async function signInWithOAuth(provider: Provider): Promise<SocialResult> {
  const redirectTo = authRedirectUrl();
  const url = await api.auth.startOAuth(provider, redirectTo);
  // Web : supabase-js a déjà redirigé la page ; le retour est traité par /auth/callback.
  if (Platform.OS === "web") return { status: "redirecting" };
  const res = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (res.type !== "success") return { status: "cancelled" };
  const session = await completeAuthFromUrl(res.url);
  await finalizeOAuthSession(session);
  return { status: "signedIn", session };
}

export async function signInWith(provider: Provider): Promise<SocialResult> {
  analytics.track("signup_started", { method: provider });
  if (provider === "apple" && Platform.OS === "ios" && (await isNativeAppleAvailable())) return signInWithAppleNative();
  return signInWithOAuth(provider);
}

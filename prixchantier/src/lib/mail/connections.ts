import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { testMailboxEnabled } from "@/lib/env";
import { decryptSecret, encryptSecret } from "./crypto";
import { refreshTokens, OAuthError, type OAuthProvider } from "./oauth";
import { GmailProvider } from "./gmail";
import { GraphProvider } from "./graph";
import { TestMailProvider } from "./test-provider";
import { MailAuthError, type MailProvider } from "./types";

export type ConnectionRow = {
  id: string;
  organization_id: string;
  provider: string;
  email: string;
  display_name: string | null;
  status: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
};

/** Marque une connexion comme expirée : l'interface demande de reconnecter. */
export async function markExpired(connectionId: string, message: string) {
  await adminClient()
    .from("mail_connections")
    .update({ status: "expired", last_error: message })
    .eq("id", connectionId);
}

/** Jeton d'accès valide, rafraîchi si besoin (jamais transmis au navigateur). */
async function accessToken(conn: ConnectionRow): Promise<string> {
  const provider = conn.provider as OAuthProvider;
  if (conn.status === "expired") throw new MailAuthError(provider);
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.access_token_enc && expiresAt - Date.now() > 120_000) {
    return decryptSecret(conn.access_token_enc);
  }
  if (!conn.refresh_token_enc) {
    await markExpired(conn.id, "Jeton de rafraîchissement absent");
    throw new MailAuthError(provider);
  }
  try {
    const tokens = await refreshTokens(provider, decryptSecret(conn.refresh_token_enc));
    const update = {
      access_token_enc: encryptSecret(tokens.accessToken),
      token_expires_at: tokens.expiresAt.toISOString(),
      status: "active",
      last_error: null,
      ...(tokens.refreshToken ? { refresh_token_enc: encryptSecret(tokens.refreshToken) } : {}),
    };
    await adminClient().from("mail_connections").update(update).eq("id", conn.id);
    Object.assign(conn, update);
    return tokens.accessToken;
  } catch (err) {
    if (err instanceof OAuthError && err.invalidGrant) {
      await markExpired(conn.id, "Autorisation révoquée ou expirée");
      throw new MailAuthError(provider);
    }
    throw err;
  }
}

export function providerFor(conn: ConnectionRow): MailProvider {
  if (conn.provider === "test") {
    if (!testMailboxEnabled()) throw new Error("Boîte de test désactivée.");
    return new TestMailProvider(conn.email);
  }
  const getToken = () => accessToken(conn);
  if (conn.provider === "google") return new GmailProvider(getToken, conn.email);
  if (conn.provider === "microsoft") return new GraphProvider(getToken, conn.email);
  throw new Error(`Fournisseur de messagerie inconnu : ${conn.provider}`);
}

export async function loadConnection(connectionId: string, organizationId: string): Promise<ConnectionRow | null> {
  const { data } = await adminClient()
    .from("mail_connections")
    .select("id, organization_id, provider, email, display_name, status, access_token_enc, refresh_token_enc, token_expires_at")
    .eq("id", connectionId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data;
}

/** Boîte d'envoi de l'utilisateur (la sienne en priorité, sinon celle de l'entreprise). */
export async function defaultConnection(organizationId: string, userId: string): Promise<ConnectionRow | null> {
  const { data } = await adminClient()
    .from("mail_connections")
    .select("id, organization_id, provider, email, display_name, status, access_token_enc, refresh_token_enc, token_expires_at, user_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (!data?.length) return null;
  return data.find((c) => c.user_id === userId) ?? data[0];
}

"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { testMailboxEnabled } from "@/lib/env";
import { ActionError, requireActionSession, runAction, type ActionResult } from "@/lib/session";
import { decryptSecret } from "@/lib/mail/crypto";
import { revokeToken, type OAuthProvider } from "@/lib/mail/oauth";
import { logActivity } from "@/lib/activity";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Boîte de test (tests bout-en-bout uniquement, désactivée en production). */
export async function connectTestMailbox(): Promise<ActionResult> {
  return runAction(async () => {
    if (!testMailboxEnabled()) throw new ActionError("Action indisponible.");
    const s = await requireActionSession();
    const { error } = await adminClient().from("mail_connections").upsert(
      {
        organization_id: s.organizationId,
        user_id: s.userId,
        provider: "test",
        email: s.email.toLowerCase(),
        display_name: s.fullName,
        status: "active",
        last_polled_at: new Date(Date.now() - 60_000).toISOString(),
      },
      { onConflict: "organization_id,provider,email" },
    );
    if (error) throw new ActionError("Connexion impossible.");
    revalidatePath("/", "layout");
  });
}

/** Déconnexion : révocation côté fournisseur (Google) puis suppression des tokens. */
export async function disconnectMailbox(connectionId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    await enforceRateLimit("destructive", s.userId);
    const admin = adminClient();
    const { data: conn } = await admin
      .from("mail_connections")
      .select("id, provider, email, refresh_token_enc")
      .eq("id", connectionId)
      .eq("organization_id", s.organizationId)
      .maybeSingle();
    if (!conn) throw new ActionError("Boîte mail introuvable.");
    if (conn.refresh_token_enc && conn.provider !== "test") {
      try {
        await revokeToken(conn.provider as OAuthProvider, decryptSecret(conn.refresh_token_enc));
      } catch {
        // La suppression locale des tokens reste effective même si la révocation échoue.
      }
    }
    const { error } = await admin.from("mail_connections").delete().eq("id", conn.id).eq("organization_id", s.organizationId);
    if (error) throw new ActionError("Déconnexion impossible. Réessayez.");
    await logActivity({ organizationId: s.organizationId, type: "mail_disconnected", message: `Boîte mail ${conn.email} déconnectée.` });
    revalidatePath("/", "layout");
  });
}

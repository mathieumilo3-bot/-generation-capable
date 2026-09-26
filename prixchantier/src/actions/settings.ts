"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { ActionError, requireActionSession, runAction, type ActionResult } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { decryptSecret } from "@/lib/mail/crypto";
import { revokeToken, type OAuthProvider } from "@/lib/mail/oauth";
import { BUCKET } from "@/lib/workflows/storage";

export async function updateNames(input: { organizationName: string; fullName: string }): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const parsed = z
      .object({ organizationName: z.string().trim().min(1).max(200), fullName: z.string().trim().max(200) })
      .safeParse(input);
    if (!parsed.success) throw new ActionError("Nom invalide.");
    const supabase = await createClient();
    const [a, b] = await Promise.all([
      supabase.from("organizations").update({ name: parsed.data.organizationName }).eq("id", s.organizationId),
      supabase.from("users").update({ full_name: parsed.data.fullName || null }).eq("id", s.userId),
    ]);
    if (a.error || b.error) throw new ActionError("Enregistrement impossible.");
    revalidatePath("/", "layout");
  });
}

async function removeTree(prefix: string) {
  const storage = adminClient().storage.from(BUCKET);
  const { data } = await storage.list(prefix, { limit: 1000 });
  for (const e of data ?? []) {
    const path = `${prefix}/${e.name}`;
    if (e.id === null) await removeTree(path);
    else await storage.remove([path]);
  }
}

/**
 * Suppression du compte. Dernier membre de l'entreprise : toutes les données
 * de l'entreprise sont supprimées (base + fichiers), et les accès aux boîtes
 * mail révoqués.
 */
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const s = await requireActionSession();
    if (confirmation.trim().toUpperCase() !== "SUPPRIMER") throw new ActionError("Saisissez SUPPRIMER pour confirmer.");
    await enforceRateLimit("destructive", s.userId);
    const admin = adminClient();
    const { count } = await admin.from("users").select("id", { count: "exact", head: true }).eq("organization_id", s.organizationId);
    const lastMember = (count ?? 0) <= 1;
    const { data: conns } = await admin
      .from("mail_connections")
      .select("id, provider, refresh_token_enc")
      .eq("organization_id", s.organizationId)
      .eq(lastMember ? "organization_id" : "user_id", lastMember ? s.organizationId : s.userId);
    for (const c of conns ?? []) {
      if (c.refresh_token_enc && c.provider !== "test") {
        await revokeToken(c.provider as OAuthProvider, decryptSecret(c.refresh_token_enc)).catch(() => undefined);
      }
      await admin.from("mail_connections").delete().eq("id", c.id);
    }
    if (lastMember) {
      await removeTree(s.organizationId);
      const { error } = await admin.from("organizations").delete().eq("id", s.organizationId);
      if (error) throw new ActionError("Suppression impossible. Contactez le support.");
    }
    const { error } = await admin.auth.admin.deleteUser(s.userId);
    if (error) throw new ActionError("Suppression du compte impossible. Contactez le support.");
    const supabase = await createClient();
    await supabase.auth.signOut();
  });
  if (!result.ok) return result;
  redirect("/login");
}

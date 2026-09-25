import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionContext = {
  userId: string;
  email: string;
  fullName: string | null;
  organizationId: string;
  organizationName: string;
};

/** Utilisateur authentifié (vérifié auprès de Supabase Auth, pas seulement le cookie). */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/**
 * Contexte complet : utilisateur + entreprise. Redirige vers /login si non
 * connecté, vers /onboarding si l'entreprise n'est pas encore créée.
 */
export const requireSession = cache(async (): Promise<SessionContext> => {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, organization_id, organizations(name)")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");
  return {
    userId: user.id,
    email: profile.email,
    fullName: profile.full_name,
    organizationId: profile.organization_id,
    organizationName: profile.organizations?.name ?? "",
  };
});

/** Variante pour les Server Actions : lève une erreur au lieu de rediriger. */
export async function requireActionSession(): Promise<SessionContext> {
  const user = await getAuthUser();
  if (!user) throw new ActionError("Votre session a expiré. Reconnectez-vous.");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, organization_id, organizations(name)")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) throw new ActionError("Créez d'abord votre entreprise.");
  return {
    userId: user.id,
    email: profile.email,
    fullName: profile.full_name,
    organizationId: profile.organization_id,
    organizationName: profile.organizations?.name ?? "",
  };
}

/** Erreur dont le message est destiné à l'utilisateur final. */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Enveloppe une Server Action : les ActionError remontent telles quelles,
 * toute autre erreur est journalisée côté serveur et remplacée par un message
 * générique (aucun détail interne ni contenu de document n'est exposé).
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, error: err.message };
    // Les redirections Next.js doivent être relancées.
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) {
      throw err;
    }
    console.error("[action] erreur inattendue:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Une erreur inattendue est survenue. Réessayez dans un instant." };
  }
}

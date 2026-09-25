"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ActionError, runAction, type ActionResult } from "@/lib/session";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

function safeNext(next: unknown) {
  // Uniquement des chemins internes (évite les redirections ouvertes).
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

const loginSchema = z.object({
  email: z.email("Adresse e-mail invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export async function login(_: unknown, form: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    await enforceRateLimit("auth", `login:${await clientIp()}`);
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      if (error.code === "email_not_confirmed") {
        throw new ActionError("Confirmez d'abord votre adresse e-mail (lien reçu à l'inscription).");
      }
      throw new ActionError("E-mail ou mot de passe incorrect.");
    }
  });
  if (!result.ok) return result;
  redirect(safeNext(form.get("next")));
}

const signupSchema = z.object({
  company: z.string().trim().min(1, "Nom de l'entreprise requis.").max(200),
  fullName: z.string().trim().min(1, "Votre nom est requis.").max(200),
  email: z.email("Adresse e-mail invalide."),
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères.").max(128),
});

export async function signup(_: unknown, form: FormData): Promise<ActionResult<{ confirmEmail: boolean }>> {
  const result = await runAction(async () => {
    const parsed = signupSchema.safeParse({
      company: form.get("company"),
      fullName: form.get("fullName"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    await enforceRateLimit("auth", `signup:${await clientIp()}`);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${env().APP_URL}/auth/callback?next=/onboarding`,
        data: { company: parsed.data.company, full_name: parsed.data.fullName },
      },
    });
    if (error) {
      if (error.code === "user_already_exists") throw new ActionError("Un compte existe déjà avec cette adresse.");
      if (error.code === "weak_password") throw new ActionError("Mot de passe trop faible.");
      throw new ActionError("Impossible de créer le compte. Réessayez.");
    }
    if (!data.session) return { confirmEmail: true };
    // Session ouverte immédiatement : on crée l'entreprise tout de suite.
    const { error: orgError } = await supabase.rpc("create_organization", {
      p_name: parsed.data.company,
      p_full_name: parsed.data.fullName,
    });
    if (orgError) throw new ActionError("Compte créé, mais l'entreprise n'a pas pu être enregistrée. Reconnectez-vous.");
    return { confirmEmail: false };
  });
  if (result.ok && !result.data.confirmEmail) redirect("/onboarding/mailbox");
  return result;
}

export async function requestPasswordReset(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const email = z.email("Adresse e-mail invalide.").safeParse(form.get("email"));
    if (!email.success) throw new ActionError("Adresse e-mail invalide.");
    await enforceRateLimit("auth", `reset:${await clientIp()}`);
    const supabase = await createClient();
    // Réponse identique que le compte existe ou non (pas d'énumération).
    await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${env().APP_URL}/auth/callback?next=/auth/reset-password`,
    });
  });
}

export async function updatePassword(_: unknown, form: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const password = String(form.get("password") ?? "");
    if (password.length < 10) throw new ActionError("Le mot de passe doit contenir au moins 10 caractères.");
    if (password !== form.get("confirm")) throw new ActionError("Les deux mots de passe ne correspondent pas.");
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new ActionError("Lien expiré ou invalide. Refaites une demande de réinitialisation.");
  });
  if (!result.ok) return result;
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

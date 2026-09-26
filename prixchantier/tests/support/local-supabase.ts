import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "@/lib/supabase/database.types";

/** Charge .env.local (stack Supabase locale) pour les tests d'intégration. */
export function loadEnv() {
  const file = join(__dirname, "../../.env.local");
  if (!existsSync(file)) throw new Error(".env.local manquant : lancez `npx supabase start` et créez .env.local");
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export function admin(): SupabaseClient<Database> {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anon(): SupabaseClient<Database> {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Crée un utilisateur + son entreprise et renvoie un client connecté (RLS appliquée). */
export async function createTenant(label: string) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
  const password = "motdepasse-test-123";
  const { error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const { data: orgId, error: orgError } = await client.rpc("create_organization", { p_name: `Entreprise ${label}`, p_full_name: `Chiffreur ${label}` });
  if (orgError) throw orgError;
  const { data: user } = await client.auth.getUser();
  return { client, email, password, orgId: orgId as string, userId: user.user!.id };
}

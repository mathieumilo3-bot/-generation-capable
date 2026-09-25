import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { env } from "@/lib/env";

let admin: SupabaseClient<Database> | null = null;

export type AdminClient = SupabaseClient<Database>;

/**
 * Client service (contourne la RLS). Réservé aux tâches de fond et aux
 * opérations serveur qui ont déjà vérifié l'organisation de l'appelant.
 * Toute requête DOIT filtrer explicitement par organization_id.
 */
export function adminClient() {
  if (!admin) {
    const e = env();
    admin = createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

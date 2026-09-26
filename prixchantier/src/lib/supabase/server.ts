import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { env } from "@/lib/env";

/** Client Supabase agissant au nom de l'utilisateur connecté (RLS appliquée). */
export async function createClient() {
  const cookieStore = await cookies();
  const e = env();
  return createServerClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit la session.
        }
      },
    },
  });
}

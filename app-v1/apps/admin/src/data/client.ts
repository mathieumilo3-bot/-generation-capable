import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseDb, type AdminDb } from "./db";
import type { AdminEnv } from "../env";

export interface Backend {
  client: SupabaseClient;
  db: AdminDb;
}

/** Client navigateur : clé PUBLISHABLE + session de l'utilisateur staff. Jamais de service_role. */
export function createBackend(env: AdminEnv): Backend {
  const client = createClient(env.client.supabaseUrl, env.client.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return { client, db: createSupabaseDb(client) };
}

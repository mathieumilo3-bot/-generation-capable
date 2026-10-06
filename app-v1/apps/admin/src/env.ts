import { parseClientEnv, type ClientEnv } from "@app/config";

export interface AdminEnv {
  client: ClientEnv;
  /** URL publique de l'app cliente (lien d'invitation). */
  publicAppUrl: string | undefined;
}

export type EnvResult = { ok: true; env: AdminEnv } | { ok: false; error: string };

/**
 * Détecte une clé SECRÈTE (nouvelle clé `sb_secret_…` ou JWT dont le rôle est celui du serveur) :
 * elle ne doit jamais être embarquée dans un bundle navigateur.
 */
export function looksLikeSecretKey(key: string): boolean {
  const k = key.trim();
  if (k.startsWith("sb_secret_")) return true;
  const parts = k.split(".");
  if (parts.length !== 3 || !parts[1]) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
    const payload: unknown = JSON.parse(json);
    return typeof payload === "object" && payload !== null && (payload as { role?: unknown }).role === "service_role";
  } catch {
    return false;
  }
}

/** Lecture de la configuration publique. Aucune clé secrète : seule la clé publishable est acceptée. */
export function loadEnv(raw: Record<string, string | undefined>): EnvResult {
  try {
    const client = parseClientEnv(raw);
    if (looksLikeSecretKey(client.supabasePublishableKey)) {
      return { ok: false, error: "VITE_SUPABASE_PUBLISHABLE_KEY contient une clé secrète : utilisez uniquement la clé publishable (publique)." };
    }
    const publicAppUrl = raw.VITE_PUBLIC_APP_URL?.trim() || client.webBaseUrl;
    return { ok: true, env: { client, publicAppUrl } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Configuration invalide." };
  }
}

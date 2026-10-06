import { parseClientEnv, type ClientEnv } from "@app/config";

export interface AdminEnv {
  client: ClientEnv;
  /** URL publique de l'app cliente (lien d'invitation). */
  publicAppUrl: string | undefined;
}

export type EnvResult = { ok: true; env: AdminEnv } | { ok: false; error: string };

/** Lecture de la configuration publique. Aucune clé secrète : seule la clé publishable est acceptée. */
export function loadEnv(raw: Record<string, string | undefined>): EnvResult {
  try {
    const client = parseClientEnv(raw);
    const publicAppUrl = raw.VITE_PUBLIC_APP_URL?.trim() || client.webBaseUrl;
    return { ok: true, env: { client, publicAppUrl } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Configuration invalide." };
  }
}

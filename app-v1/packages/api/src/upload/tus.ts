import type { FileSource } from "./types";

/**
 * Client TUS 1.0 minimal, volontairement sans dépendance : tourne à l'identique
 * sur web, iOS et Android (fetch + Blob.slice). Reprise après coupure via HEAD,
 * retries avec backoff, ré-authentification en cas de 401.
 * Supabase Storage impose des morceaux de 6 Mio.
 */
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

export class TusError extends Error {
  constructor(readonly kind: "aborted" | "auth" | "fatal" | "network", message: string, readonly status?: number) {
    super(message);
    this.name = "TusError";
  }
}

export interface TusParams {
  file: FileSource;
  endpoint: string;
  headers: () => Promise<Record<string, string>>;
  metadata: Record<string, string>;
  /** URL d'une session existante à reprendre. */
  resumeUrl?: string;
  onUrl?: (url: string) => void;
  onProgress?: (bytes: number, total: number) => void;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  chunkSize?: number;
  /** Délais (ms) entre tentatives ; la longueur = nombre de retries par morceau. */
  retryDelays?: number[];
  sleep?: (ms: number) => Promise<void>;
}

const b64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
};

export const encodeMetadata = (m: Record<string, string>): string =>
  Object.entries(m).map(([k, v]) => `${k} ${b64(v)}`).join(",");

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function tusUpload(p: TusParams): Promise<void> {
  const f = p.fetchImpl ?? fetch;
  const chunk = p.chunkSize ?? TUS_CHUNK_SIZE;
  const delays = p.retryDelays ?? [0, 1000, 3000, 5000, 10000, 20000];
  const sleep = p.sleep ?? defaultSleep;
  if (p.file.size <= 0) throw new TusError("fatal", "Fichier vide");

  const abortCheck = () => { if (p.signal?.aborted) throw new TusError("aborted", "Envoi annulé"); };
  const baseHeaders = async () => ({ "Tus-Resumable": "1.0.0", ...(await p.headers()) });

  const call = async (url: string, init: RequestInit): Promise<Response> => {
    try {
      return await f(url, { ...init, signal: p.signal });
    } catch (e) {
      if (p.signal?.aborted) throw new TusError("aborted", "Envoi annulé");
      throw new TusError("network", (e as Error).message);
    }
  };

  const create = async (): Promise<string> => {
    const res = await call(p.endpoint, {
      method: "POST",
      headers: { ...(await baseHeaders()), "Upload-Length": String(p.file.size), "Upload-Metadata": encodeMetadata(p.metadata) },
    });
    if (res.status === 401 || res.status === 403) throw new TusError("auth", "Non autorisé", res.status);
    if (res.status >= 500) throw new TusError("network", `Serveur indisponible (${res.status})`, res.status);
    if (res.status !== 201) throw new TusError("fatal", `Création refusée (${res.status})`, res.status);
    const loc = res.headers.get("Location");
    if (!loc) throw new TusError("fatal", "Location manquante");
    return new URL(loc, p.endpoint).toString();
  };

  /** Offset serveur ; null si la session n'existe plus (expirée / inconnue). */
  const head = async (url: string): Promise<number | null> => {
    const res = await call(url, { method: "HEAD", headers: await baseHeaders() });
    if (res.status === 404 || res.status === 410 || res.status === 403) return null;
    if (res.status === 401) throw new TusError("auth", "Non autorisé", 401);
    if (res.status >= 500) throw new TusError("network", `Serveur indisponible (${res.status})`, res.status);
    if (!res.ok) throw new TusError("fatal", `HEAD refusé (${res.status})`, res.status);
    const off = Number(res.headers.get("Upload-Offset"));
    return Number.isFinite(off) ? off : 0;
  };

  let url = p.resumeUrl;
  let offset = 0;
  let authRetried = false;

  const establish = async (): Promise<void> => {
    if (url) {
      const off = await head(url);
      if (off === null) url = undefined; else { offset = off; return; }
    }
    url = await create();
    offset = 0;
    p.onUrl?.(url);
  };

  // Établissement (avec retries réseau).
  for (let attempt = 0; ; attempt++) {
    abortCheck();
    try { await establish(); break; }
    catch (e) {
      const err = e as TusError;
      if (err.kind === "auth" && !authRetried) { authRetried = true; continue; }
      if (err.kind !== "network" || attempt >= delays.length) throw err;
      await sleep(delays[attempt] ?? 0);
    }
  }
  p.onProgress?.(offset, p.file.size);

  let failures = 0;
  while (offset < p.file.size) {
    abortCheck();
    const end = Math.min(offset + chunk, p.file.size);
    try {
      const res = await call(url!, {
        method: "PATCH",
        headers: { ...(await baseHeaders()), "Content-Type": "application/offset+octet-stream", "Upload-Offset": String(offset) },
        body: p.file.slice(offset, end),
      });
      if (res.status === 204 || res.status === 200) {
        const next = Number(res.headers.get("Upload-Offset"));
        offset = Number.isFinite(next) && next > offset ? next : end;
        failures = 0;
        p.onProgress?.(offset, p.file.size);
        continue;
      }
      if (res.status === 409) { // décalage d'offset : on se resynchronise
        const off = await head(url!);
        if (off === null) { await establish(); } else offset = off;
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        if (authRetried) throw new TusError("auth", "Non autorisé", res.status);
        authRetried = true;
        continue;
      }
      if (res.status >= 500 || res.status === 429 || res.status === 408) throw new TusError("network", `Erreur serveur (${res.status})`, res.status);
      throw new TusError("fatal", `Envoi refusé (${res.status})`, res.status);
    } catch (e) {
      const err = e as TusError;
      if (err.kind === "aborted" || err.kind === "fatal" || err.kind === "auth") throw err;
      if (failures >= delays.length) throw new TusError("network", "Connexion perdue", err.status);
      await sleep(delays[failures] ?? 0);
      failures++;
      // Après un échec réseau, on relit l'offset réel (le morceau a pu être reçu).
      try {
        const off = await head(url!);
        if (off === null) await establish(); else offset = off;
      } catch (he) {
        const h = he as TusError;
        if (h.kind === "aborted" || h.kind === "fatal") throw h;
        // Réseau toujours coupé : on laisse la boucle retenter après le délai suivant.
      }
    }
  }
}

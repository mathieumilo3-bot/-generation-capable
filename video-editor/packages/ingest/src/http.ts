import type { FetchLike } from "./types.js";
import { SourceAccessError } from "./types.js";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff exponentiel plafonné avec un peu d'aléa (évite que N workers réessaient en même temps). */
export function backoffMs(attempt: number, baseMs = 1000, maxMs = 60000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp * (0.75 + Math.random() * 0.5));
}

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * POST/GET JSON avec reprise sur erreurs transitoires (réseau, 429, 5xx).
 * Les 4xx définitifs (lien privé, introuvable) remontent immédiatement en
 * SourceAccessError non réessayable — inutile d'insister.
 */
export async function requestJson<T>(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit & { retries?: number; timeoutMs?: number; acceptStatuses?: number[] } = {}
): Promise<{ status: number; body: T; headers: Headers }> {
  const retries = init.retries ?? 4;
  const timeoutMs = init.timeoutMs ?? 30000;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();
      const accepted = res.ok || (init.acceptStatuses ?? []).includes(res.status);
      if (!accepted) {
        if (isRetryableStatus(res.status) && attempt <= retries) {
          lastErr = new Error(`HTTP ${res.status}`);
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new SourceAccessError(`HTTP ${res.status} sur ${new URL(url).host} : ${text.slice(0, 300)}`, isRetryableStatus(res.status));
      }
      let body: T;
      try {
        body = (text ? JSON.parse(text) : {}) as T;
      } catch {
        throw new SourceAccessError(`Réponse non-JSON de ${new URL(url).host} (HTTP ${res.status}) : ${text.slice(0, 200)}`, false);
      }
      return { status: res.status, body, headers: res.headers };
    } catch (err) {
      if (err instanceof SourceAccessError) throw err;
      lastErr = err;
      if (attempt <= retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
    }
  }
  throw new SourceAccessError(`Source injoignable : ${(lastErr as Error)?.message ?? lastErr}`, true);
}

/** Déduit le type de média depuis le MIME ou l'extension (avant vérification ffprobe). */
export function guessKind(filename: string, mimeType?: string): "video" | "photo" | "other" {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.startsWith("video/") || mime.includes("quicktime") || mime.includes("mpeg-4") || mime.includes("movie")) return "video";
  if (mime.startsWith("image/") || mime.includes("jpeg") || mime.includes("heic") || mime.includes("heif") || mime.includes("png")) return "photo";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "m4v", "webm", "mkv", "avi", "3gp", "mts", "m2ts"].includes(ext)) return "video";
  if (["jpg", "jpeg", "heic", "heif", "png", "webp", "gif", "tif", "tiff", "dng", "avif"].includes(ext)) return "photo";
  return "other";
}

/** Nom de fichier sûr pour le disque et les clés objet (pas de /, pas de .., pas de caractères de contrôle). */
export function safeFilename(name: string, fallback: string): string {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}

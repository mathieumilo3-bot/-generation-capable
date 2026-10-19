import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { rm, stat, rename } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { MediaKind } from "@video-editor/shared-types";
// Import profond (pas le barrel @video-editor/render) : ffmpeg.ts n'entraîne
// pas Remotion — voir la même note dans apps/web/src/app/api/projects/route.ts.
import { probe, type MediaInfo } from "@video-editor/render/dist/ffmpeg.js";
import type { DownloadRequest, FetchLike } from "./types.js";
import { SourceAccessError } from "./types.js";
import { isRetryableStatus } from "./http.js";

const execFileAsync = promisify(execFile);

/**
 * Télécharge vers `destPath` en reprenant un `.part` existant (en-tête
 * Range) : une coupure réseau sur une vidéo de 2 Go ne fait pas tout
 * recommencer. Vérifie la taille annoncée quand la source la connaît.
 */
export async function downloadToFile(
  req: DownloadRequest,
  destPath: string,
  opts: { fetchImpl?: FetchLike; expectedSize?: number; timeoutMs?: number } = {}
): Promise<{ sizeBytes: number; contentType?: string; filename?: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const part = `${destPath}.part`;
  let offset = 0;
  try {
    offset = (await stat(part)).size;
  } catch {
    offset = 0;
  }
  if (opts.expectedSize && offset >= opts.expectedSize) {
    // .part complet d'un passage précédent interrompu juste avant le rename.
    if (offset === opts.expectedSize) {
      await rename(part, destPath);
      return { sizeBytes: offset };
    }
    await rm(part, { force: true });
    offset = 0;
  }

  const headers: Record<string, string> = { ...(req.headers ?? {}) };
  if (offset > 0) headers.range = `bytes=${offset}-`;
  // Délai d'inactivité généreux, pas de limite totale : 1 000 vidéos 4K prennent du temps.
  const controller = new AbortController();
  const idleMs = opts.timeoutMs ?? 120000;
  let idleTimer = setTimeout(() => controller.abort(), idleMs);
  const bump = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), idleMs);
  };

  try {
    const res = await fetchImpl(req.url, { headers, signal: controller.signal, redirect: "follow" });
    if (res.status === 416 && offset > 0) {
      await rm(part, { force: true });
      throw new SourceAccessError("Reprise refusée par le serveur (416), téléchargement relancé de zéro.", true);
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new SourceAccessError(`Téléchargement HTTP ${res.status} : ${text.slice(0, 200)}`, isRetryableStatus(res.status) || res.status === 403);
    }
    const contentType = res.headers.get("content-type") ?? undefined;
    if (contentType?.startsWith("text/html")) {
      throw new SourceAccessError("La source a renvoyé une page HTML au lieu du fichier (quota, avertissement ou lien expiré).", true);
    }
    const append = res.status === 206 && offset > 0;
    if (!append) offset = 0;
    const body = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
    body.on("data", bump);
    await pipeline(body, createWriteStream(part, { flags: append ? "a" : "w" }));
    const size = (await stat(part)).size;
    if (opts.expectedSize && size !== opts.expectedSize) {
      await rm(part, { force: true });
      throw new SourceAccessError(`Taille incohérente (${size} octets reçus, ${opts.expectedSize} attendus).`, true);
    }
    await rename(part, destPath);
    const disposition = res.headers.get("content-disposition") ?? "";
    const fname = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] ?? /filename="?([^";]+)"?/i.exec(disposition)?.[1];
    return { sizeBytes: size, contentType, filename: fname ? decodeURIComponent(fname) : undefined };
  } catch (err) {
    if (controller.signal.aborted) throw new SourceAccessError(`Téléchargement bloqué (aucune donnée pendant ${idleMs / 1000}s).`, true);
    throw err;
  } finally {
    clearTimeout(idleTimer);
  }
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

const IMAGE_CODECS = new Set(["mjpeg", "png", "hevc_image", "heic", "webp", "gif", "tiff", "bmp", "av1_image"]);

export interface ProbedMedia {
  kind: MediaKind;
  info?: MediaInfo;
}

/**
 * Type RÉEL du fichier (jamais celui déclaré par la source) : une piste
 * vidéo de plus d'une demi-seconde = vidéo ; une image unique = photo.
 * Les HEIC que ffprobe ne lit pas restent « photo » si la source le dit.
 */
export async function probeMedia(path: string, declared: MediaKind): Promise<ProbedMedia> {
  try {
    const info = await probe(path);
    const isStill = IMAGE_CODECS.has(info.videoCodec) || info.container === "image2" || info.container.endsWith("_pipe");
    if (info.width > 0 && !isStill && info.videoDurationSec > 0.5) return { kind: "video", info };
    if (info.width > 0) return { kind: "photo", info };
    return { kind: declared === "video" ? "other" : declared, info };
  } catch {
    return { kind: declared === "video" ? "other" : declared };
  }
}

/** Miniature JPEG 480 px de large (rotation iPhone appliquée automatiquement par ffmpeg). */
export async function makeThumbnail(inputPath: string, outPath: string, kind: MediaKind, durationSec?: number): Promise<boolean> {
  const args = ["-hide_banner", "-y"];
  if (kind === "video") {
    const at = Math.min(1, Math.max(0, (durationSec ?? 0) * 0.1));
    args.push("-ss", at.toFixed(2));
  }
  args.push("-i", inputPath, "-frames:v", "1", "-vf", "scale='min(480,iw)':-2", "-q:v", "4", outPath);
  try {
    await execFileAsync("ffmpeg", args, { timeout: 60000, maxBuffer: 1024 * 1024 * 8 });
    return (await stat(outPath)).size > 0;
  } catch {
    return false;
  }
}

const EXT_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
  gif: "image/gif",
};

export function mimeFromFilename(filename: string, fallback = "application/octet-stream"): string {
  return EXT_MIME[filename.split(".").pop()?.toLowerCase() ?? ""] ?? fallback;
}

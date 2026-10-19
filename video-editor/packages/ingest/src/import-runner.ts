import { mkdir, rm, statfs } from "node:fs/promises";
import { join } from "node:path";
import type { Db } from "@video-editor/db";
import type { MediaAnalysis, MediaAsset, MediaImport, MediaImportStatus, MediaKind } from "@video-editor/shared-types";
import type { MediaSource, RemoteItem } from "./types.js";
import { SourceAccessError } from "./types.js";
import type { ObjectStore } from "./object-store.js";
import { parseShareUrl } from "./share-url.js";
import { createMediaSource } from "./sources/index.js";
import { backoffMs, safeFilename, sleep } from "./http.js";
import { downloadToFile, makeThumbnail, mimeFromFilename, probeMedia, sha256File } from "./media.js";
import { analyzeVideo } from "./analysis.js";

export interface RunImportOptions {
  db: Db;
  store: ObjectStore;
  importId: string;
  /** Dossier de travail sur le disque du SERVEUR (fichiers en transit, supprimés après envoi vers R2). */
  workDir: string;
  /** Source injectée (tests) — sinon déduite du lien. */
  source?: MediaSource;
  /** Téléchargements simultanés. */
  concurrency?: number;
  /** Tentatives max par fichier, tous passages confondus. */
  maxAssetAttempts?: number;
  /** Nouvelles tentatives immédiates (avec backoff) dans un même passage. */
  inlineRetries?: number;
  /** Délai de base avant reprise automatique d'un import partiel. */
  retryDelayBaseMs?: number;
  log?: (msg: string) => void;
}

export const DEFAULT_MAX_ASSET_ATTEMPTS = 5;
const MAX_IMPORT_ATTEMPTS = 8;

export function clientSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "client";
}

export function objectKeysFor(imp: MediaImport, assetId: string, filename: string): { original: string; thumb: string } {
  const base = `clients/${clientSlug(imp.clientName)}/${imp.id}`;
  return {
    original: `${base}/originals/${assetId}/${safeFilename(filename, `${assetId}.bin`)}`,
    thumb: `${base}/thumbs/${assetId}.jpg`,
  };
}

/** Choix des fichiers du mode test : surtout des vidéos (le montage), et au moins une photo s'il y en a. */
export function pickSample(pending: MediaAsset[], wanted: number): MediaAsset[] {
  if (wanted <= 0) return [];
  const videos = pending.filter((a) => a.kind === "video");
  const photos = pending.filter((a) => a.kind === "photo");
  const others = pending.filter((a) => a.kind === "other");
  const photoSlots = photos.length > 0 ? Math.max(1, Math.floor(wanted / 3)) : 0;
  const picked = [...videos.slice(0, Math.max(0, wanted - photoSlots)), ...photos.slice(0, photoSlots)];
  for (const pool of [videos, photos, others]) {
    for (const a of pool) {
      if (picked.length >= wanted) break;
      if (!picked.includes(a)) picked.push(a);
    }
  }
  return picked.slice(0, wanted).sort((a, b) => a.position - b.position);
}

async function ensureDiskSpace(dir: string, neededBytes: number): Promise<void> {
  try {
    const s = await statfs(dir);
    const free = s.bavail * s.bsize;
    const margin = 512 * 1024 * 1024;
    if (free < neededBytes + margin) {
      throw new SourceAccessError(
        `Espace disque insuffisant sur le serveur (${(free / 1e9).toFixed(1)} Go libres, ${(neededBytes / 1e9).toFixed(1)} Go nécessaires) — réduis VIDEO_EDITOR_IMPORT_CONCURRENCY ou agrandis le volume.`,
        true
      );
    }
  } catch (err) {
    if (err instanceof SourceAccessError) throw err;
    // statfs indisponible (FS exotique) : on tente quand même.
  }
}

interface ProcessContext {
  db: Db;
  store: ObjectStore;
  source: MediaSource;
  imp: MediaImport;
  workDir: string;
  maxAttempts: number;
  inlineRetries: number;
  log: (msg: string) => void;
}

/**
 * Un fichier : URL fraîche → téléchargement (reprise Range) → empreinte →
 * type/durée/format réels (ffprobe) → miniature → pré-analyse → envoi R2.
 * Rien ne reste sur le disque du serveur après coup.
 */
async function processAsset(ctx: ProcessContext, asset: MediaAsset, item: RemoteItem): Promise<void> {
  const { db, store, source, imp, log } = ctx;
  db.markMediaAssetDownloading(asset.id);
  const dir = join(ctx.workDir, imp.id, asset.id);
  await mkdir(dir, { recursive: true });
  let lastErr: unknown;
  for (let attempt = 1; attempt <= ctx.inlineRetries + 1; attempt++) {
    try {
      if (item.sizeBytes) await ensureDiskSpace(ctx.workDir, item.sizeBytes);
      const req = await source.resolveDownload(item);
      const localPath = join(dir, "original");
      const dl = await downloadToFile(req, localPath, { expectedSize: item.sizeBytes });
      const discoveredName = req.filenameHint ?? dl.filename;
      const filename = discoveredName && asset.originalFilename.startsWith(item.externalId) ? discoveredName : asset.originalFilename;

      const sha256 = await sha256File(localPath);
      const probed = await probeMedia(localPath, item.kind);
      if (probed.kind === "other") {
        db.skipMediaAsset(asset.id, "Ni photo ni vidéo lisible (format non reconnu par ffprobe).");
        log(`  ⊘ ${filename} ignoré (format non reconnu)`);
        return;
      }
      const kind: MediaKind = probed.kind;
      const info = probed.info;
      const durationSec = kind === "video" ? info?.durationSec : undefined;

      // Miniature : la source d'abord pour les photos (HEIC illisible par
      // ffmpeg), ffmpeg d'abord pour les vidéos (image représentative).
      const thumbPath = join(dir, "thumb.jpg");
      let hasThumb = false;
      const fromSource = async () => {
        const t = await source.resolveThumbnail(item).catch(() => null);
        if (!t) return false;
        try {
          await downloadToFile(t, thumbPath, { timeoutMs: 30000 });
          return true;
        } catch {
          return false;
        }
      };
      if (kind === "photo") hasThumb = (await fromSource()) || (await makeThumbnail(localPath, thumbPath, kind));
      else hasThumb = (await makeThumbnail(localPath, thumbPath, kind, durationSec)) || (await fromSource());

      let analysis: MediaAnalysis | undefined;
      if (kind === "video" && info) {
        try {
          analysis = await analyzeVideo(localPath, info);
        } catch (err) {
          analysis = { score: 0.5, highlights: [], notes: [`analyse impossible : ${(err as Error).message}`] };
        }
      }

      const keys = objectKeysFor(imp, asset.id, filename);
      const mime = item.mimeType && item.mimeType.includes("/") ? item.mimeType : mimeFromFilename(filename, dl.contentType);
      // Reprise : un original déjà présent dans R2 avec la bonne taille n'est pas renvoyé.
      if ((await store.head(keys.original)) !== dl.sizeBytes) await store.putFile(keys.original, localPath, mime);
      if (hasThumb) await store.putFile(keys.thumb, thumbPath, "image/jpeg");

      db.completeMediaAsset(asset.id, {
        objectKey: keys.original,
        thumbKey: hasThumb ? keys.thumb : undefined,
        sha256,
        sizeBytes: dl.sizeBytes,
        kind,
        mimeType: mime,
        width: info?.width || undefined,
        height: info?.height || undefined,
        durationSec,
        videoCodec: kind === "video" ? info?.videoCodec : undefined,
        container: info?.container.replace(/_pipe$/, ""),
        hasAudio: kind === "video" ? info?.hasAudio : undefined,
        analysis,
        originalFilename: filename !== asset.originalFilename ? filename : undefined,
      });
      log(
        `  ✓ ${filename} — ${kind}${durationSec ? ` ${durationSec.toFixed(1)}s` : ""}${info?.width ? ` ${info.width}x${info.height}` : ""} ${(dl.sizeBytes / 1e6).toFixed(1)} Mo${analysis ? ` score ${analysis.score}` : ""}`
      );
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      lastErr = err;
      const retryable = !(err instanceof SourceAccessError) || err.retryable;
      if (!retryable || attempt > ctx.inlineRetries) break;
      log(`  ↻ ${asset.originalFilename} : ${(err as Error).message} — nouvel essai ${attempt + 1}/${ctx.inlineRetries + 1}`);
      await sleep(backoffMs(attempt, 2000, 30000));
    }
  }
  const retryable = !(lastErr instanceof SourceAccessError) || lastErr.retryable;
  const msg = (lastErr as Error)?.message ?? String(lastErr);
  const status = retryable ? db.failMediaAsset(asset.id, msg, ctx.maxAttempts) : db.failMediaAsset(asset.id, msg, 0);
  // Le .part est conservé si une reprise est prévue (téléchargement repris là où il s'est arrêté).
  if (status === "failed") await rm(dir, { recursive: true, force: true });
  log(`  ✗ ${asset.originalFilename} : ${msg} (${status === "pending" ? "reprise automatique prévue" : "échec définitif"})`);
}

async function pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>, shouldStop: () => boolean): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next++]!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Un passage d'import complet, rejouable à volonté : relit la source,
 * ajoute les nouveaux fichiers, saute ceux déjà dans R2, retente les
 * échecs temporaires. Renvoie le statut final de l'import.
 */
export async function runImport(opts: RunImportOptions): Promise<MediaImportStatus> {
  const { db, store, importId } = opts;
  const log = opts.log ?? ((m: string) => console.log(m));
  const imp = db.getMediaImport(importId);
  if (!imp) throw new Error(`Import introuvable : ${importId}`);
  const maxAttempts = opts.maxAssetAttempts ?? DEFAULT_MAX_ASSET_ATTEMPTS;

  const heartbeat = setInterval(() => {
    try {
      db.touchMediaImport(importId);
    } catch {
      /* la base peut être momentanément verrouillée */
    }
  }, 10000);
  heartbeat.unref?.();

  const scheduleRetry = (status: MediaImportStatus, error: string | null, retry: boolean): MediaImportStatus => {
    const fresh = db.getMediaImport(importId)!;
    const canRetry = retry && fresh.attempts < MAX_IMPORT_ATTEMPTS;
    const delay = backoffMs(fresh.attempts, opts.retryDelayBaseMs ?? 5 * 60 * 1000, 2 * 60 * 60 * 1000);
    db.updateMediaImport(importId, {
      status,
      error,
      nextRetryAt: canRetry ? new Date(Date.now() + delay).toISOString() : null,
    });
    if (canRetry) log(`[import ${importId}] reprise automatique dans ${Math.round(delay / 60000)} min`);
    return status;
  };

  try {
    db.updateMediaImport(importId, { status: "listing", workerPid: process.pid });
    log(`[import ${importId}] Lecture du lien ${imp.sourceUrl} (${imp.provider}) — stockage : ${store.label}`);

    let source: MediaSource;
    let listing;
    try {
      source = opts.source ?? createMediaSource(parseShareUrl(imp.sourceUrl));
      listing = await source.list();
    } catch (err) {
      const retryable = err instanceof SourceAccessError ? err.retryable : true;
      log(`[import ${importId}] ✗ Lien inaccessible : ${(err as Error).message}`);
      return scheduleRetry("failed", (err as Error).message, retryable);
    }

    const byExternalId = new Map<string, RemoteItem>();
    let totalBytes = 0;
    listing.items.forEach((item, position) => {
      byExternalId.set(item.externalId, item);
      totalBytes += item.sizeBytes ?? 0;
      db.upsertMediaAsset({
        importId,
        externalId: item.externalId,
        originalFilename: safeFilename(item.filename, `${item.externalId}.bin`),
        kind: item.kind,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        width: item.width,
        height: item.height,
        durationSec: item.durationSec,
        takenAt: item.takenAt,
        position,
      });
    });
    db.updateMediaImport(importId, { status: "importing", sourceTitle: listing.title, totalItems: listing.items.length, totalBytes });
    const videos = listing.items.filter((i) => i.kind === "video").length;
    log(
      `[import ${importId}] ✓ Accès automatisé OK — « ${listing.title ?? "sans titre"} » : ${listing.items.length} fichier(s) (${videos} vidéo(s), ${listing.items.length - videos} photo(s)), ${(totalBytes / 1e9).toFixed(2)} Go annoncés`
    );

    const all = db.listMediaAssets(importId);
    for (const a of all) {
      if (a.status !== "ready" && a.status !== "skipped" && !byExternalId.has(a.externalId)) {
        db.skipMediaAsset(a.id, "Retiré de la source depuis un passage précédent.");
      }
    }
    const pending = db
      .listMediaAssets(importId)
      .filter((a) => (a.status === "pending" || a.status === "downloading") && a.attempts < maxAttempts && byExternalId.has(a.externalId));

    let targets = pending;
    if (imp.mode === "probe") {
      const alreadyDone = all.filter((a) => a.status === "ready").length;
      targets = pickSample(pending, imp.sampleSize - alreadyDone);
      log(`[import ${importId}] Mode TEST : ${targets.length} fichier(s) sur ${listing.items.length}`);
    }

    const concurrency = opts.concurrency ?? parseInt(process.env.VIDEO_EDITOR_IMPORT_CONCURRENCY ?? "3", 10);
    const ctx: ProcessContext = {
      db,
      store,
      source,
      imp: db.getMediaImport(importId)!,
      workDir: opts.workDir,
      maxAttempts,
      inlineRetries: opts.inlineRetries ?? 2,
      log,
    };
    const cancelled = () => db.getMediaImport(importId)?.status === "cancelled";
    await pool(targets, concurrency, (a) => processAsset(ctx, a, byExternalId.get(a.externalId)!), cancelled);
    if (cancelled()) {
      log(`[import ${importId}] Annulé.`);
      return "cancelled";
    }

    const counts = db.countMediaAssets(importId);
    const summary = `${counts.ready} prêt(s), ${counts.failed} échec(s) définitif(s), ${counts.pending} en attente, ${counts.skipped} ignoré(s)`;
    log(`[import ${importId}] Bilan : ${summary}`);

    if (imp.mode === "probe") {
      const sampleFailed = targets.length > 0 && targets.every((t) => db.getMediaAsset(t.id)?.status !== "ready");
      if (sampleFailed) return scheduleRetry("failed", "Aucun fichier du test n'a pu être importé — voir les erreurs par fichier.", false);
      db.updateMediaImport(importId, { status: "sampled", error: null, nextRetryAt: null });
      return "sampled";
    }
    const retryablePending = db
      .listMediaAssets(importId, { status: "pending" })
      .filter((a) => a.attempts > 0 && a.attempts < maxAttempts).length;
    if (counts.failed === 0 && counts.pending === 0) {
      db.updateMediaImport(importId, { status: "completed", error: null, nextRetryAt: null });
      return "completed";
    }
    return scheduleRetry("partial", summary, retryablePending > 0 || counts.pending > 0);
  } finally {
    clearInterval(heartbeat);
  }
}

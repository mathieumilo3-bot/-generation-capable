import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, link, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Db } from "@video-editor/db";
import type { MediaAsset, MediaContainer, MediaCodec, Project } from "@video-editor/shared-types";
import type { ObjectStore } from "./object-store.js";
import { safeFilename } from "./http.js";

const execFileAsync = promisify(execFile);

/**
 * Pont bibliothèque → moteur de montage existant. Un montage depuis la
 * bibliothèque crée un projet ordinaire (mêmes tables, même pipeline,
 * même UI de suivi) dont les rushs sont des copies locales d'originaux
 * stockés dans R2. Le pipeline lui-même n'est pas modifié : il voit des
 * rushs sur disque, comme pour un upload classique.
 */

export interface RushPlan {
  asset: MediaAsset;
  /** Extrait (highlight) d'une longue vidéo ; absent = fichier entier. */
  startSec?: number;
  endSec?: number;
  durationSec: number;
}

export interface SelectOptions {
  /** Sélection manuelle (cases cochées dans la bibliothèque). Sinon : sélection automatique. */
  assetIds?: string[];
  maxRushes?: number;
  /** Budget total de rushs envoyés au montage (secondes). */
  maxTotalSec?: number;
  /** Au-delà de cette durée, on n'envoie que les passages utiles détectés. */
  highlightOverSec?: number;
}

/**
 * Sélectionne les séquences à monter. Automatique : meilleures vidéos par
 * score de pré-analyse (exposition, mouvement, voix), longues vidéos
 * réduites à leurs passages utiles, puis remises dans l'ordre de l'album
 * (chronologie du client). Le pipeline affine ensuite segment par segment.
 */
export function selectForMontage(assets: MediaAsset[], opts: SelectOptions = {}): RushPlan[] {
  const maxRushes = opts.maxRushes ?? 15;
  const maxTotalSec = opts.maxTotalSec ?? 300;
  const highlightOver = opts.highlightOverSec ?? 45;
  const ready = assets.filter((a) => a.status === "ready" && a.kind === "video" && a.objectKey && (a.durationSec ?? 0) > 0.5);
  const explicit = opts.assetIds && opts.assetIds.length > 0 ? new Set(opts.assetIds) : null;

  let ranked: MediaAsset[];
  if (explicit) {
    ranked = ready.filter((a) => explicit.has(a.id));
  } else {
    const usable = ready.filter((a) => !a.analysis?.tooDark);
    ranked = (usable.length > 0 ? usable : ready).sort((a, b) => (b.analysis?.score ?? 0.5) - (a.analysis?.score ?? 0.5));
  }

  const plans: RushPlan[] = [];
  let total = 0;
  for (const asset of ranked) {
    if (plans.length >= maxRushes) break;
    const duration = asset.durationSec ?? 0;
    const remaining = maxTotalSec - total;
    if (remaining <= 1) break;
    const highlights = asset.analysis?.highlights ?? [];
    const useHighlights = highlights.length > 0 && (duration > highlightOver || duration > remaining);
    if (useHighlights) {
      for (const h of highlights) {
        const len = h.end - h.start;
        if (plans.length >= maxRushes || total + len > maxTotalSec) break;
        plans.push({ asset, startSec: h.start, endSec: h.end, durationSec: len });
        total += len;
      }
    } else if (duration <= remaining || explicit) {
      plans.push({ asset, durationSec: duration });
      total += duration;
    }
  }
  return plans.sort((a, b) => a.asset.position - b.asset.position || (a.startSec ?? 0) - (b.startSec ?? 0));
}

const CONTAINERS: Record<string, MediaContainer> = { mp4: "mp4", mov: "mov", m4v: "m4v", webm: "webm" };

function codecOf(asset: MediaAsset): MediaCodec {
  if (asset.videoCodec === "h264") return "h264";
  if (asset.videoCodec === "hevc" || asset.videoCodec === "h265") return "h265";
  if (asset.videoCodec === "prores") return "prores";
  if (asset.videoCodec === "vp9") return "vp9";
  if (asset.videoCodec === "av1") return "av1";
  return "unknown";
}

export function createProjectFromLibrary(
  db: Db,
  input: { userId: string; title: string; plans: RushPlan[]; storageRoot: string }
): Project {
  if (input.plans.length === 0) throw new Error("Aucune vidéo exploitable sélectionnée pour ce montage.");
  const project = db.createProject({ userId: input.userId, title: input.title });
  const rushesDir = join(input.storageRoot, project.id, "rushes");
  input.plans.forEach((plan, i) => {
    const isCut = plan.startSec !== undefined && plan.endSec !== undefined;
    const base = safeFilename(plan.asset.originalFilename, `${plan.asset.id}.mov`);
    const filename = isCut ? `${String(i + 1).padStart(3, "0")}_${base.replace(/\.[^.]+$/, "")}_extrait.mp4` : `${String(i + 1).padStart(3, "0")}_${base}`;
    const ext = filename.split(".").pop()?.toLowerCase() ?? "mp4";
    const rush = db.createRush({
      projectId: project.id,
      originalFilename: plan.asset.originalFilename,
      storagePath: join(rushesDir, filename),
      container: isCut ? "mp4" : CONTAINERS[ext] ?? "mov",
      codec: isCut ? "h264" : codecOf(plan.asset),
      durationSec: plan.durationSec,
      hasAudio: plan.asset.hasAudio ?? true,
    });
    db.linkRushToLibraryAsset({ rushId: rush.id, assetId: plan.asset.id, projectId: project.id, startSec: plan.startSec, endSec: plan.endSec });
  });
  return project;
}

async function sizeOf(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}

/**
 * Exécuté par le worker de montage AVANT le pipeline : rapatrie depuis R2
 * les originaux nécessaires dans un cache partagé (un original n'est
 * téléchargé qu'une fois, quel que soit le nombre de montages), puis
 * prépare chaque rush (lien dur vers le cache, ou extrait ré-encodé).
 * Ne fait rien pour un projet sans rush de bibliothèque.
 */
export async function materializeLibraryRushes(
  db: Db,
  store: ObjectStore,
  projectId: string,
  storageRoot: string,
  log: (msg: string) => void = console.log
): Promise<number> {
  const links = db.listLibraryRushesForProject(projectId);
  let prepared = 0;
  for (const { rush, asset, startSec, endSec } of links) {
    if (((await sizeOf(rush.storagePath)) ?? 0) > 0) continue;
    if (!asset.objectKey) throw new Error(`Le fichier ${asset.originalFilename} n'est pas (encore) dans le stockage cloud.`);
    const cachePath = join(storageRoot, "media-cache", asset.id, safeFilename(asset.originalFilename, `${asset.id}.bin`));
    if ((await sizeOf(cachePath)) !== (asset.sizeBytes ?? -1)) {
      log(`[bibliothèque] Récupération de ${asset.originalFilename} depuis ${store.label}`);
      await store.getToFile(asset.objectKey, cachePath);
    }
    await mkdir(dirname(rush.storagePath), { recursive: true });
    if (startSec !== undefined && endSec !== undefined) {
      await execFileAsync(
        "ffmpeg",
        ["-hide_banner", "-y", "-ss", String(startSec), "-to", String(endSec), "-i", cachePath, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", rush.storagePath],
        { timeout: Math.max(120000, (endSec - startSec) * 20000), maxBuffer: 1024 * 1024 * 16 }
      );
    } else {
      try {
        await link(cachePath, rush.storagePath);
      } catch {
        await copyFile(cachePath, rush.storagePath);
      }
    }
    prepared++;
  }
  return prepared;
}

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { cp, mkdir } from "node:fs/promises";
import os from "node:os";
import { tmpdir } from "node:os";
import { resolveStorageRoot, toStorageRelativePath } from "./storage-root.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export { resolveStorageRoot, toStorageRelativePath };

/** Plafond dur de concurrence Remotion — au-delà, Chromium/RAM deviennent le bottleneck. */
const MAX_REMOTION_CONCURRENCY = 16;
/** Budget mémoire prudent par frame-renderer Chromium concurrent (1080x1920), en Mo. */
const REMOTION_MEM_PER_WORKER_MB = 1400;

/** Mémoire réellement disponible (Mo) — MemAvailable sous Linux, sinon os.freemem. */
function availableMemMb(): number {
  try {
    const meminfo = readFileSync("/proc/meminfo", "utf-8");
    const m = /MemAvailable:\s+(\d+)\s+kB/.exec(meminfo);
    if (m) return Math.round(Number.parseInt(m[1]!, 10) / 1024);
  } catch {
    /* pas Linux */
  }
  return Math.round(os.freemem() / (1024 * 1024));
}

/**
 * Concurrence de rendu Remotion réellement adaptée à la machine (§ objectif
 * rendu). Sur une machine 16 vCPU performance, renvoie 16 → les 16 CPU
 * rendent des frames EN PARALLÈLE. Formule demandée :
 *   max(1, min(nbCPU, 16))
 * bornée EN PLUS par la RAM disponible pour ne jamais déclencher l'OOM
 * killer (stabilité > concurrence brute) : si 16 workers ne tiennent pas
 * en mémoire, on descend automatiquement.
 *
 * `explicit` (REMOTION_CONCURRENCY / profil) surcharge tout si fourni.
 */
export function resolveRenderConcurrency(explicit?: number | null): { concurrency: number; reason: string } {
  const cpuCount = os.cpus().length || 1;
  // Priorité à une valeur explicite (profil), sinon à l'override d'env
  // REMOTION_CONCURRENCY, sinon auto d'après CPU/RAM.
  const envOverride = Number.parseInt(process.env.REMOTION_CONCURRENCY ?? "", 10);
  const forced = explicit != null && explicit > 0 ? explicit : Number.isFinite(envOverride) && envOverride > 0 ? envOverride : null;
  if (forced != null) {
    const c = Math.max(1, Math.min(forced, MAX_REMOTION_CONCURRENCY));
    return { concurrency: c, reason: `forcé (REMOTION_CONCURRENCY/profil=${forced}) → ${c}` };
  }
  const byCpu = Math.max(1, Math.min(cpuCount, MAX_REMOTION_CONCURRENCY));
  const availMb = availableMemMb();
  const byRam = Math.max(1, Math.floor(availMb / REMOTION_MEM_PER_WORKER_MB));
  const concurrency = Math.max(1, Math.min(byCpu, byRam));
  const limited = byRam < byCpu ? "RAM" : "CPU";
  return {
    concurrency,
    reason: `${cpuCount} vCPU · ${availMb}Mo dispo → CPU:${byCpu} · RAM:${byRam} · retenu ${concurrency} (limité par ${limited})`,
  };
}

let cachedBundle: { url: string; outDir: string } | null = null;

/**
 * Empreinte du code de la composition Remotion (remotion-src). Le bundle
 * ne doit être reconstruit QUE si ce code change — pas à chaque job. On
 * hache le contenu des sources pour obtenir un chemin de bundle stable et
 * réutilisable ENTRE PROCESS (chaque worker de rendu est un process
 * séparé — sans ça, les ~10s de bundle sont repayées à chaque montage).
 */
function remotionSrcHash(srcDir: string): string {
  const h = createHash("sha1");
  const files = readdirSync(srcDir).sort();
  for (const f of files) {
    try {
      h.update(f);
      h.update(readFileSync(join(srcDir, f)));
    } catch {
      /* fichier illisible — ignoré dans l'empreinte */
    }
  }
  return h.digest("hex").slice(0, 12);
}

/**
 * `bundle({ publicDir })` prend un INSTANTANÉ de publicDir au moment de
 * l'appel — constaté empiriquement : un fichier créé après le premier
 * bundle() est invisible au serveur de rendu même dans un nouveau
 * sous-dossier, y compris sans aucune suppression. Fixer `outDir` rend
 * l'emplacement de cet instantané prévisible, pour pouvoir y copier
 * explicitement chaque nouvelle vidéo avant rendu (`syncAssetToBundle`)
 * plutôt que de re-bundler à chaque appel (coûteux, ~10s).
 *
 * Le bundle est désormais PERSISTANT sur disque, indexé par l'empreinte
 * du code source : si un bundle valide existe déjà (même code), on le
 * réutilise sans rappeler bundle() — y compris dans un nouveau process
 * (§5, §6 du brief factory : ne pas reconstruire inutilement le bundle).
 */
async function getBundle(): Promise<{ url: string; outDir: string }> {
  if (cachedBundle) return cachedBundle;
  const srcDir = join(__dirname, "..", "remotion-src");
  const entry = join(srcDir, "index.tsx");
  const hash = remotionSrcHash(srcDir);
  // outDir DOIT être hors de publicDir (storageRoot) : sinon bundle() copie
  // récursivement son propre dossier de sortie dans lui-même (constaté :
  // ENAMETOOLONG après une explosion de "public/public/public/...").
  const outDir = join(tmpdir(), `video-editor-remotion-bundle-${hash}`);

  // Réutilisation cross-process : un bundle Remotion valide contient un
  // index.html à sa racine. S'il existe, on ne rebundle pas.
  if (existsSync(join(outDir, "index.html"))) {
    cachedBundle = { url: outDir, outDir };
    return cachedBundle;
  }

  // Construire dans un dossier temporaire propre au process puis renommer
  // atomiquement — si un autre worker a gagné la course entre-temps, on
  // utilise son résultat plutôt que d'écraser.
  const tmpOut = `${outDir}.tmp-${process.pid}`;
  const url = await bundle({ entryPoint: entry, publicDir: resolveStorageRoot(), outDir: tmpOut, onProgress: () => undefined });
  try {
    if (!existsSync(join(outDir, "index.html"))) {
      renameSync(tmpOut, outDir);
      cachedBundle = { url: outDir, outDir };
    } else {
      cachedBundle = { url: outDir, outDir };
    }
  } catch {
    // rename a échoué (course perdue / FS particulier) — on utilise le
    // bundle temporaire tel quel, toujours valide pour ce process.
    cachedBundle = { url, outDir: tmpOut };
  }
  return cachedBundle;
}

async function syncAssetToBundle(bundleOutDir: string, absolutePath: string): Promise<string> {
  const relativePath = toStorageRelativePath(absolutePath);
  const dest = join(bundleOutDir, "public", relativePath);
  await mkdir(dirname(dest), { recursive: true });
  await cp(absolutePath, dest);
  return relativePath;
}

/**
 * L'environnement fournit déjà un Chromium pré-installé pour Playwright
 * (voir le README de session) — on le réutilise pour Remotion plutôt que
 * de télécharger un second binaire identique. Configurable via
 * REMOTION_BROWSER_EXECUTABLE pour un déploiement où Remotion gère son
 * propre téléchargement (comportement par défaut si la variable n'est
 * pas définie et qu'aucun chemin connu n'existe).
 */
function resolveBrowserExecutable(): string | null {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return process.env.REMOTION_BROWSER_EXECUTABLE;
  // Le Chrome "normal" pré-installé pour Playwright a retiré le old headless
  // mode ; chrome-headless-shell est l'implémentation dédiée à l'automatisation
  // sans tête et fonctionne avec le lanceur de Remotion (voir smoke test).
  const candidates = [
    "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export type HabillageCaptionStyle = "bold_dynamic" | "minimal_clean" | "karaoke_word" | "classic_lowerthird";

export interface RenderHabillageInput {
  videoSrc: string;
  outputPath: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  captions: {
    startFrame: number;
    endFrame: number;
    words: { word: string; startFrame: number; endFrame: number; emphasize: boolean }[];
  }[];
  zoomWindows: { startFrame: number; endFrame: number; scale: number }[];
  captionStyle: HabillageCaptionStyle;
  /**
   * Concurrence de rendu Remotion (nombre d'onglets Chromium rendant des
   * frames EN PARALLÈLE). null/absent = auto adapté au nombre de CPU
   * (resolveRenderConcurrency). Une valeur explicite (profil/config
   * REMOTION_CONCURRENCY) surcharge.
   */
  concurrency?: number | null;
  /**
   * Callback de progression RÉELLE, basé sur les frames effectivement
   * rendues par Remotion (jamais simulé) — sert à afficher
   * "Export final — X%" et à émettre un heartbeat régulier.
   */
  onProgress?: (p: { renderedFrames: number; totalFrames: number; concurrency: number }) => void;
}

export async function renderHabillage(
  input: RenderHabillageInput
): Promise<{ durationMs: number; framesRendered: number; concurrency: number }> {
  const start = Date.now();
  const { url: bundleUrl, outDir } = await getBundle();
  const relativeVideoSrc = await syncAssetToBundle(outDir, input.videoSrc);
  const inputProps = {
    videoSrc: relativeVideoSrc,
    captions: input.captions,
    zoomWindows: input.zoomWindows,
    captionStyle: input.captionStyle,
    durationInFrames: input.durationInFrames,
    fps: input.fps,
  };
  const browserExecutable = resolveBrowserExecutable();
  const { concurrency, reason } = resolveRenderConcurrency(input.concurrency);
  console.log(`[remotion] Concurrence de rendu : ${reason}`);

  const composition = await selectComposition({
    serveUrl: bundleUrl,
    id: "Habillage",
    inputProps,
    browserExecutable,
  });

  let lastRendered = 0;
  await renderMedia({
    composition: {
      ...composition,
      width: input.width,
      height: input.height,
      fps: input.fps,
      durationInFrames: input.durationInFrames,
    },
    serveUrl: bundleUrl,
    codec: "h264",
    outputLocation: input.outputPath,
    inputProps,
    browserExecutable,
    chromiumOptions: { headless: true },
    concurrency,
    onProgress: ({ renderedFrames }) => {
      lastRendered = renderedFrames;
      input.onProgress?.({ renderedFrames, totalFrames: input.durationInFrames, concurrency });
    },
  });
  return { durationMs: Date.now() - start, framesRendered: lastRendered || input.durationInFrames, concurrency };
}

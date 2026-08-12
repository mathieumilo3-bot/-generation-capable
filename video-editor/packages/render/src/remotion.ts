import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolveStorageRoot, toStorageRelativePath } from "./storage-root.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export { resolveStorageRoot, toStorageRelativePath };

let cachedBundle: { url: string; outDir: string } | null = null;

/**
 * `bundle({ publicDir })` prend un INSTANTANÉ de publicDir au moment de
 * l'appel — constaté empiriquement : un fichier créé après le premier
 * bundle() est invisible au serveur de rendu même dans un nouveau
 * sous-dossier, y compris sans aucune suppression. Fixer `outDir` rend
 * l'emplacement de cet instantané prévisible, pour pouvoir y copier
 * explicitement chaque nouvelle vidéo avant rendu (`syncAssetToBundle`)
 * plutôt que de re-bundler à chaque appel (coûteux, ~10s).
 */
async function getBundle(): Promise<{ url: string; outDir: string }> {
  if (cachedBundle) return cachedBundle;
  const entry = join(__dirname, "..", "remotion-src", "index.tsx");
  // outDir DOIT être hors de publicDir (storageRoot) : sinon bundle() copie
  // récursivement son propre dossier de sortie dans lui-même (constaté :
  // ENAMETOOLONG après une explosion de "public/public/public/...").
  const outDir = join(tmpdir(), "video-editor-remotion-bundle");
  const url = await bundle({ entryPoint: entry, publicDir: resolveStorageRoot(), outDir, onProgress: () => undefined });
  cachedBundle = { url, outDir };
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
}

export async function renderHabillage(input: RenderHabillageInput): Promise<{ durationMs: number }> {
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
  const composition = await selectComposition({
    serveUrl: bundleUrl,
    id: "Habillage",
    inputProps,
    browserExecutable,
  });
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
  });
  return { durationMs: Date.now() - start };
}

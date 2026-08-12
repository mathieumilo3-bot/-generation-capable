import { join, relative, isAbsolute } from "node:path";
import { mkdirSync } from "node:fs";

/**
 * Isolé de remotion.ts délibérément : ce fichier ne dépend d'aucun
 * package lourd (@remotion/bundler entraîne esbuild + des binaires
 * natifs rspack). apps/web importe CE fichier directement (chemin
 * profond, pas le barrel @video-editor/render) partout où il n'a besoin
 * que de résoudre des chemins de stockage, pour ne jamais faire
 * charger le bundler Remotion dans le process serveur Next.js — seuls
 * les scripts CLI spawnés (packages/pipeline/src/cli-*.ts) en ont besoin.
 *
 * Remotion ne sert au navigateur headless que les fichiers sous
 * `publicDir` (via `staticFile()`) — un chemin absolu arbitraire hors de
 * ce dossier est inaccessible au composant `<OffthreadVideo>`. Tous les
 * fichiers vidéo du pipeline doivent donc vivre sous cette racine unique.
 */
export function resolveStorageRoot(): string {
  const root = process.env.VIDEO_EDITOR_STORAGE_ROOT ?? join(process.cwd(), "storage");
  mkdirSync(root, { recursive: true });
  return root;
}

export function toStorageRelativePath(absolutePath: string): string {
  const root = resolveStorageRoot();
  if (!isAbsolute(absolutePath)) return absolutePath;
  const rel = relative(root, absolutePath);
  if (rel.startsWith("..")) {
    throw new Error(
      `${absolutePath} est hors de VIDEO_EDITOR_STORAGE_ROOT (${root}) — Remotion ne peut pas le servir. Tous les fichiers vidéo doivent vivre sous cette racine.`
    );
  }
  return rel;
}

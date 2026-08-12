import { join } from "node:path";
import { mkdirSync } from "node:fs";

/**
 * Réimplémentation volontaire (pas un import de @video-editor/render) :
 * ce fichier reste importable par n'importe quelle route Next.js sans
 * jamais entraîner @remotion/bundler dans le bundle webpack du serveur —
 * voir la note dans jobs.ts. Doit rester strictement identique à
 * packages/render/src/storage-root.ts::resolveStorageRoot.
 */
export function resolveStorageRoot(): string {
  const root = process.env.VIDEO_EDITOR_STORAGE_ROOT ?? join(process.cwd(), "..", "..", "storage");
  mkdirSync(root, { recursive: true });
  return root;
}

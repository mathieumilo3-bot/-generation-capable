import { useCallback, useSyncExternalStore } from "react";
import type { UploadItem, UploadSummary } from "@app/api";
import { uploadManager } from "@/lib/uploads";

export interface UploadsSnapshot {
  /** Copies : le gestionnaire modifie ses éléments en place, React a besoin d'objets neufs pour re-rendre. */
  items: UploadItem[];
  summary: UploadSummary;
}

// Le gestionnaire notifie à chaque octet reçu : on maintient un numéro de version global (abonnement permanent,
// pour qu'il ne soit jamais périmé) et on ne recalcule l'instantané que lorsqu'il a changé.
let version = 0;
const listeners = new Set<() => void>();
uploadManager.subscribe(() => { version++; listeners.forEach((l) => l()); });

const EMPTY: UploadsSnapshot = {
  items: [],
  summary: { count: 0, doneCount: 0, bytesUploaded: 0, bytesTotal: 0, allDone: false, anyFailed: false, anyActive: false, anyPaused: false, fraction: 0 },
};
const cache = new Map<string, { version: number; snap: UploadsSnapshot }>();

function snapshotFor(projectId: string): UploadsSnapshot {
  const hit = cache.get(projectId);
  if (hit && hit.version === version) return hit.snap;
  const snap: UploadsSnapshot = { items: uploadManager.list(projectId).map((i) => ({ ...i, file: { ...i.file } })), summary: uploadManager.summary(projectId) };
  cache.set(projectId, { version, snap });
  return snap;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/**
 * État des envois d'un projet (useSyncExternalStore sur le gestionnaire). Les envois continuent
 * quand l'écran est quitté : le gestionnaire vit au niveau de l'app.
 */
export function useUploads(projectId: string | null | undefined): UploadsSnapshot & {
  retry(localId: string): void;
  cancel(localId: string): Promise<void>;
} {
  const get = useCallback(() => (projectId ? snapshotFor(projectId) : EMPTY), [projectId]);
  const snap = useSyncExternalStore(subscribe, get, get);
  return {
    ...snap,
    retry: useCallback((id: string) => uploadManager.retry(id), []),
    cancel: useCallback((id: string) => uploadManager.cancel(id), []),
  };
}

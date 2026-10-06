/** Source de données d'un fichier : sur le web un File/Blob, sur mobile `fetch(uri).blob()` (adossé au disque, pas à la RAM JS). */
export interface FileSource {
  size: number;
  slice(start: number, end: number): Blob;
}

/** Fichier choisi par l'utilisateur (galerie, fichiers, caméra). */
export interface FileRef {
  name: string;
  size: number;
  mime: string;
  /** URI native (file://, ph://, content://) — résolue en FileSource par la plateforme. */
  uri?: string;
  /** Web : l'objet File lui-même. */
  blob?: Blob;
  durationSec?: number | null;
}

export type UploadStatus =
  | "queued" | "registering" | "uploading" | "paused" | "completing" | "done" | "failed" | "canceled";

export interface UploadItem {
  localId: string;
  projectId: string;
  kind: "raw" | "reference" | "image" | "logo" | "audio_note";
  file: Omit<FileRef, "blob">;
  assetId?: string;
  bucket?: string;
  path?: string;
  /** URL TUS de la session d'envoi en cours (valable ~24 h) : permet de reprendre sans rien renvoyer. */
  tusUrl?: string;
  status: UploadStatus;
  bytesUploaded: number;
  attempts: number;
  errorCode?: string;
  createdAt: number;
}

export interface UploadSummary {
  count: number;
  doneCount: number;
  bytesUploaded: number;
  bytesTotal: number;
  allDone: boolean;
  anyFailed: boolean;
  anyActive: boolean;
  anyPaused: boolean;
  /** 0..1 */
  fraction: number;
}

/** Persistance clé-valeur (AsyncStorage / localStorage / mémoire). */
export interface KVStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class MemoryStore implements KVStore {
  private m = new Map<string, string>();
  async getItem(k: string) { return this.m.get(k) ?? null; }
  async setItem(k: string, v: string) { this.m.set(k, v); }
  async removeItem(k: string) { this.m.delete(k); }
}

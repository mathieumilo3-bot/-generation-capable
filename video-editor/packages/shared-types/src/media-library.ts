/**
 * Bibliothèque média cloud : fichiers importés depuis un lien de partage
 * (iCloud Photos, Google Drive…) vers le stockage objet (Cloudflare R2),
 * indépendamment de tout projet. Un import = un lien d'un client ; un
 * asset = un fichier de ce lien. Les projets de montage pointent vers ces
 * assets (aucune ré-importation pour un second montage).
 */

export type MediaProvider = "icloud_shared_album" | "icloud_shared_collection" | "icloud_link" | "google_drive";

export type MediaKind = "video" | "photo" | "other";

/**
 * Cycle de vie d'un import :
 *  queued → listing → importing → (sampled | completed | partial | failed)
 * `sampled` = mode test terminé sur N fichiers, en attente du feu vert
 * pour l'import complet. `partial` = terminé avec des fichiers en échec
 * définitif (les autres sont exploitables).
 */
export type MediaImportStatus =
  | "queued"
  | "listing"
  | "importing"
  | "sampled"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export const ACTIVE_IMPORT_STATUSES: MediaImportStatus[] = ["listing", "importing"];

export type MediaImportMode = "probe" | "full";

export interface MediaImport {
  id: string;
  userId: string;
  /** Nom libre du client (multi-clients : sert aussi de préfixe de clé R2). */
  clientName: string;
  sourceUrl: string;
  provider: MediaProvider;
  /** Nom de l'album/dossier côté source, si exposé. */
  sourceTitle?: string;
  mode: MediaImportMode;
  /** Nombre de fichiers traités en mode test. */
  sampleSize: number;
  status: MediaImportStatus;
  totalItems: number;
  totalBytes: number;
  attempts: number;
  workerId?: string;
  workerPid?: number;
  heartbeatAt?: string;
  /** Prochaine reprise automatique (fichiers en échec temporaire). */
  nextRetryAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type MediaAssetStatus = "pending" | "downloading" | "ready" | "failed" | "skipped";

/** Fenêtre utile détectée dans une vidéo (secondes, relatives au fichier). */
export interface MediaHighlight {
  start: number;
  end: number;
  score: number;
  reason: string;
}

/** Pré-analyse d'un fichier faite UNE fois à l'import, réutilisée par tous les montages. */
export interface MediaAnalysis {
  /** Score d'exploitabilité global [0,1]. */
  score: number;
  /** Luma moyenne (0-255). */
  brightness?: number;
  tooDark?: boolean;
  tooBright?: boolean;
  /** Proportion du fichier avec du son non silencieux [0,1]. */
  speechRatio?: number;
  meanVolumeDb?: number;
  /** Nombre de changements de plan détectés. */
  sceneCuts?: number;
  /** Mouvement moyen (score de scène ffmpeg moyen) [0,1]. */
  motion?: number;
  highlights: MediaHighlight[];
  notes: string[];
}

export interface MediaAsset {
  id: string;
  importId: string;
  /** Identifiant stable côté source (guid iCloud, fileId Drive) — clé d'idempotence. */
  externalId: string;
  originalFilename: string;
  kind: MediaKind;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  videoCodec?: string;
  container?: string;
  hasAudio?: boolean;
  /** Date de prise de vue côté source, si exposée. */
  takenAt?: string;
  status: MediaAssetStatus;
  attempts: number;
  /** Clé de l'original dans le stockage objet. */
  objectKey?: string;
  /** Clé de la miniature JPEG dans le stockage objet. */
  thumbKey?: string;
  analysis?: MediaAnalysis;
  /** Ordre dans la source (tri d'affichage). */
  position: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaImportCounts {
  total: number;
  pending: number;
  downloading: number;
  ready: number;
  failed: number;
  skipped: number;
  videos: number;
  photos: number;
  readyBytes: number;
  readyVideoSec: number;
}

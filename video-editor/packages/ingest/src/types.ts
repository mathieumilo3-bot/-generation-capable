import type { MediaKind, MediaProvider } from "@video-editor/shared-types";

/** Lien de partage reconnu, avant tout appel réseau. */
export interface ShareLink {
  provider: MediaProvider;
  /** Jeton/identifiant extrait de l'URL (token d'album, shortGUID, folderId…). */
  token: string;
  /** Google Drive : clé de ressource des anciens liens (`resourcekey=`). */
  resourceKey?: string;
  /** Google Drive : le lien désigne un fichier unique plutôt qu'un dossier. */
  isSingleFile?: boolean;
  normalizedUrl: string;
}

/** Requête HTTP prête à exécuter pour récupérer les octets d'un fichier. */
export interface DownloadRequest {
  url: string;
  headers?: Record<string, string>;
  /** Nom de fichier d'origine quand la source ne le donne qu'au téléchargement (iCloud sharedstreams). */
  filenameHint?: string;
}

/** Fichier découvert dans une source distante. Aucun octet téléchargé à ce stade. */
export interface RemoteItem {
  externalId: string;
  filename: string;
  kind: MediaKind;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  takenAt?: string;
  /** Données propres à la source (guid, checksums…), gardées en mémoire le temps d'un passage. */
  meta?: Record<string, unknown>;
}

export interface SourceListing {
  title?: string;
  items: RemoteItem[];
}

/**
 * Une source distante (iCloud, Drive…). Les URLs de téléchargement iCloud
 * expirent (≈ 1 h) : elles ne sont donc jamais stockées, mais résolues au
 * moment de chaque tentative via `resolveDownload` / `resolveThumbnail`.
 */
export interface MediaSource {
  readonly provider: MediaProvider;
  list(): Promise<SourceListing>;
  resolveDownload(item: RemoteItem): Promise<DownloadRequest>;
  /** Miniature fournie par la source (utile pour les HEIC que ffmpeg ne décode pas). null si absente. */
  resolveThumbnail(item: RemoteItem): Promise<DownloadRequest | null>;
}

export type FetchLike = typeof fetch;

/** Erreur explicite quand la source refuse l'accès automatisé (lien privé, expiré, Apple qui bloque…). */
export class SourceAccessError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "SourceAccessError";
  }
}

import type { DownloadRequest, FetchLike, MediaSource, RemoteItem, SourceListing } from "../types.js";
import { SourceAccessError } from "../types.js";
import { guessKind, requestJson } from "../http.js";

/**
 * Google Drive — alternative officielle et stable à iCloud : API Drive v3
 * documentée, dossiers partagés « Tous les utilisateurs disposant du
 * lien », originaux intacts, sous-dossiers parcourus récursivement.
 *
 * Nécessite une clé d'API Google (gratuite) avec l'API Drive activée :
 * GOOGLE_DRIVE_API_KEY. Aucune connexion au compte du client n'est
 * nécessaire tant que le dossier est partagé par lien.
 */

const API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const FILE_FIELDS =
  "id,name,mimeType,size,createdTime,resourceKey,imageMediaMetadata(width,height,time),videoMediaMetadata(width,height,durationMillis),shortcutDetails(targetId,targetMimeType,targetResourceKey)";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  resourceKey?: string;
  imageMediaMetadata?: { width?: number; height?: number; time?: string };
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
  shortcutDetails?: { targetId: string; targetMimeType: string; targetResourceKey?: string };
}

export interface GoogleDriveOptions {
  apiKey?: string;
  resourceKey?: string;
  isSingleFile?: boolean;
  fetchImpl?: FetchLike;
  /** Tests uniquement : remplace https://www.googleapis.com/drive/v3. */
  apiBaseOverride?: string;
  /** Profondeur max de sous-dossiers parcourus. */
  maxDepth?: number;
}

export class GoogleDriveSource implements MediaSource {
  readonly provider = "google_drive" as const;
  private readonly fetchImpl: FetchLike;
  private readonly api: string;
  private readonly apiKey: string;
  /** id → resourceKey, transmis en en-tête pour les anciens liens. */
  private readonly resourceKeys = new Map<string, string>();

  constructor(
    private readonly rootId: string,
    private readonly opts: GoogleDriveOptions = {}
  ) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.api = opts.apiBaseOverride ?? API;
    const key = opts.apiKey ?? process.env.GOOGLE_DRIVE_API_KEY;
    if (!key) {
      throw new SourceAccessError(
        "GOOGLE_DRIVE_API_KEY manquante : crée une clé d'API Google (console.cloud.google.com → API Drive activée) et ajoute-la aux secrets du serveur.",
        false
      );
    }
    this.apiKey = key;
    if (opts.resourceKey) this.resourceKeys.set(rootId, opts.resourceKey);
  }

  private headers(...ids: string[]): Record<string, string> {
    const keys = ids.filter((id) => this.resourceKeys.has(id)).map((id) => `${id}/${this.resourceKeys.get(id)}`);
    return keys.length > 0 ? { "X-Goog-Drive-Resource-Keys": keys.join(",") } : {};
  }

  private url(path: string, params: Record<string, string>): string {
    const qs = new URLSearchParams({ ...params, key: this.apiKey, supportsAllDrives: "true" });
    return `${this.api}${path}?${qs.toString()}`;
  }

  private async get<T>(path: string, params: Record<string, string>, ...ids: string[]): Promise<T> {
    try {
      const { body } = await requestJson<T>(this.fetchImpl, this.url(path, params), { headers: this.headers(...ids) });
      return body;
    } catch (err) {
      if (err instanceof SourceAccessError && /HTTP 404|HTTP 403/.test(err.message)) {
        throw new SourceAccessError(
          `Google Drive refuse l'accès (${/HTTP (\d+)/.exec(err.message)?.[1]}) : vérifie que le dossier est partagé en « Tous les utilisateurs disposant du lien » et que l'API Drive est activée pour la clé. ${err.message}`,
          false
        );
      }
      throw err;
    }
  }

  private toItem(f: DriveFile, path: string, position: number): RemoteItem | null {
    const kind = guessKind(f.name, f.mimeType);
    if (kind === "other") return null;
    const durMs = f.videoMediaMetadata?.durationMillis ? parseInt(f.videoMediaMetadata.durationMillis, 10) : undefined;
    return {
      externalId: f.id,
      filename: f.name,
      kind,
      mimeType: f.mimeType,
      sizeBytes: f.size ? parseInt(f.size, 10) : undefined,
      width: f.videoMediaMetadata?.width ?? f.imageMediaMetadata?.width,
      height: f.videoMediaMetadata?.height ?? f.imageMediaMetadata?.height,
      durationSec: durMs !== undefined && Number.isFinite(durMs) ? durMs / 1000 : undefined,
      takenAt: f.createdTime,
      meta: { path, position },
    };
  }

  async list(): Promise<SourceListing> {
    if (this.opts.isSingleFile) {
      const f = await this.get<DriveFile>(`/files/${this.rootId}`, { fields: FILE_FIELDS }, this.rootId);
      const item = this.toItem(f, "", 0);
      if (!item) throw new SourceAccessError(`Le fichier Drive « ${f.name} » n'est ni une photo ni une vidéo.`, false);
      return { title: f.name, items: [item] };
    }

    const root = await this.get<{ name?: string; mimeType?: string }>(`/files/${this.rootId}`, { fields: "name,mimeType" }, this.rootId);
    const items: RemoteItem[] = [];
    const maxDepth = this.opts.maxDepth ?? 6;
    const queue: { id: string; path: string; depth: number }[] = [{ id: this.rootId, path: "", depth: 0 }];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const folder = queue.shift()!;
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      let pageToken: string | undefined;
      do {
        const page = await this.get<{ files?: DriveFile[]; nextPageToken?: string }>(
          "/files",
          {
            q: `'${folder.id}' in parents and trashed = false`,
            fields: `nextPageToken,files(${FILE_FIELDS})`,
            pageSize: "1000",
            orderBy: "name",
            includeItemsFromAllDrives: "true",
            ...(pageToken ? { pageToken } : {}),
          },
          folder.id
        );
        for (const f of page.files ?? []) {
          if (f.resourceKey) this.resourceKeys.set(f.id, f.resourceKey);
          const target =
            f.mimeType === SHORTCUT_MIME && f.shortcutDetails
              ? { ...f, id: f.shortcutDetails.targetId, mimeType: f.shortcutDetails.targetMimeType, resourceKey: f.shortcutDetails.targetResourceKey }
              : f;
          if (target.resourceKey) this.resourceKeys.set(target.id, target.resourceKey);
          if (target.mimeType === FOLDER_MIME) {
            if (folder.depth < maxDepth) queue.push({ id: target.id, path: `${folder.path}${f.name}/`, depth: folder.depth + 1 });
            continue;
          }
          const item = this.toItem(target, folder.path, items.length);
          if (item) items.push(item);
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
    }
    return { title: root.name, items };
  }

  async resolveDownload(item: RemoteItem): Promise<DownloadRequest> {
    return { url: this.url(`/files/${item.externalId}`, { alt: "media" }), headers: this.headers(item.externalId) };
  }

  async resolveThumbnail(): Promise<DownloadRequest | null> {
    // thumbnailLink exige souvent une session Google : la miniature est
    // générée par ffmpeg depuis l'original téléchargé.
    return null;
  }
}

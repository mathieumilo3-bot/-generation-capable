import type { DownloadRequest, FetchLike, MediaSource, RemoteItem, SourceListing } from "../types.js";
import { SourceAccessError } from "../types.js";
import { requestJson } from "../http.js";
import { isTrustedIcloudUrl } from "./icloud-hosts.js";

/**
 * iCloud « Album partagé » (liens www.icloud.com/sharedalbum/#TOKEN).
 *
 * API web publique NON documentée par Apple, utilisée par la page
 * icloud.com elle-même et par de nombreux outils open source depuis
 * des années :
 *   POST https://pNN-sharedstreams.icloud.com/<token>/sharedstreams/webstream     {"streamCtag":null}
 *   POST https://pNN-sharedstreams.icloud.com/<token>/sharedstreams/webasseturls  {"photoGuids":[…]}
 * La partition NN se déduit du jeton ; si elle est fausse Apple répond
 * HTTP 330 avec le bon hôte dans `X-Apple-MMe-Host` (corps JSON ou en-tête).
 *
 * Limite Apple à connaître : un album partagé ne contient PAS les
 * originaux — Apple y stocke les photos réduites (~2048 px) et les vidéos
 * en 720p (1080p sur les albums récents). Pour des originaux, demander au
 * client un « lien iCloud » (Copier le lien iCloud) ou un dossier Drive.
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function base62ToInt(s: string): number {
  let n = 0;
  for (const c of s) n = n * 62 + BASE62.indexOf(c);
  return n;
}

export function sharedStreamsPartition(token: string): number {
  return token[0] === "A" ? base62ToInt(token.slice(1, 2)) : base62ToInt(token.slice(1, 3));
}

interface Derivative {
  fileSize?: string | number;
  checksum: string;
  width?: string | number;
  height?: string | number;
}

interface StreamPhoto {
  photoGuid: string;
  derivatives: Record<string, Derivative>;
  mediaAssetType?: string;
  dateCreated?: string;
  width?: string | number;
  height?: string | number;
  videoDuration?: string | number;
}

interface WebStream {
  streamName?: string;
  photos?: StreamPhoto[];
  "X-Apple-MMe-Host"?: string;
}

interface AssetUrls {
  items?: Record<string, { url_expiry?: string; url_location: string; url_path: string }>;
  locations?: Record<string, { scheme: string; hosts: string[] }>;
}

const num = (v: string | number | undefined): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

export interface SharedStreamsOptions {
  fetchImpl?: FetchLike;
  /** Tests uniquement : base d'URL à la place de https://pNN-sharedstreams.icloud.com. */
  baseUrlOverride?: string;
  trustUrl?: (url: string) => boolean;
}

export class IcloudSharedStreamsSource implements MediaSource {
  readonly provider = "icloud_shared_album" as const;
  private readonly fetchImpl: FetchLike;
  private readonly trustUrl: (url: string) => boolean;
  private host: string;

  constructor(
    private readonly token: string,
    private readonly opts: SharedStreamsOptions = {}
  ) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.trustUrl = opts.trustUrl ?? isTrustedIcloudUrl;
    const partition = sharedStreamsPartition(token).toString().padStart(2, "0");
    this.host = `p${partition}-sharedstreams.icloud.com`;
  }

  private baseUrl(): string {
    if (this.opts.baseUrlOverride) return `${this.opts.baseUrlOverride}/${this.token}/sharedstreams`;
    return `https://${this.host}/${this.token}/sharedstreams`;
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    // Jusqu'à 3 redirections de partition (HTTP 330).
    for (let hop = 0; hop < 3; hop++) {
      const res = await requestJson<T & { "X-Apple-MMe-Host"?: string }>(this.fetchImpl, `${this.baseUrl()}/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://www.icloud.com" },
        body: JSON.stringify(body),
        acceptStatuses: [330],
      });
      if (res.status === 330) {
        const next = res.body["X-Apple-MMe-Host"] ?? res.headers.get("x-apple-mme-host") ?? undefined;
        if (!next || !/^p\d+-sharedstreams\.icloud\.com$/.test(next)) {
          throw new SourceAccessError("iCloud a redirigé l'album vers un hôte inattendu — accès automatisé refusé.", false);
        }
        this.host = next;
        continue;
      }
      return res.body;
    }
    throw new SourceAccessError("Trop de redirections de partition iCloud.", true);
  }

  async list(): Promise<SourceListing> {
    let stream: WebStream;
    try {
      stream = await this.post<WebStream>("webstream", { streamCtag: null });
    } catch (err) {
      if (err instanceof SourceAccessError && /HTTP 404/.test(err.message)) {
        throw new SourceAccessError(
          "Album partagé iCloud introuvable : le lien a été désactivé ou le « site web public » de l'album n'est pas activé (Réglages de l'album → Site web public).",
          false
        );
      }
      throw err;
    }
    const items: RemoteItem[] = (stream.photos ?? []).map((p) => {
      const isVideo = p.mediaAssetType === "video" || Object.keys(p.derivatives).some((k) => /^\d+p$/.test(k));
      const entries = Object.entries(p.derivatives);
      // Original au mieux = la dérivée la plus lourde (hors image d'affiche des vidéos).
      const candidates = entries.filter(([k]) => !isVideo || k !== "PosterFrame");
      const best = candidates.sort((a, b) => (num(b[1].fileSize) ?? 0) - (num(a[1].fileSize) ?? 0))[0];
      const poster = isVideo
        ? p.derivatives.PosterFrame
        : entries
            .filter(([, d]) => (num(d.width) ?? 0) >= 240)
            .sort((a, b) => (num(a[1].fileSize) ?? 0) - (num(b[1].fileSize) ?? 0))[0]?.[1];
      return {
        externalId: p.photoGuid,
        filename: `${p.photoGuid}.${isVideo ? "mp4" : "jpg"}`,
        kind: isVideo ? "video" : "photo",
        sizeBytes: best ? num(best[1].fileSize) : undefined,
        width: best ? num(best[1].width) ?? num(p.width) : num(p.width),
        height: best ? num(best[1].height) ?? num(p.height) : num(p.height),
        durationSec: num(p.videoDuration),
        takenAt: p.dateCreated,
        meta: { photoGuid: p.photoGuid, checksum: best?.[1].checksum, posterChecksum: poster?.checksum },
      } satisfies RemoteItem;
    });
    return { title: stream.streamName, items };
  }

  private async urlForChecksum(photoGuid: string, checksum: string): Promise<string> {
    const res = await this.post<AssetUrls>("webasseturls", { photoGuids: [photoGuid] });
    const item = res.items?.[checksum];
    if (!item) throw new SourceAccessError(`iCloud n'a pas fourni d'URL pour ${photoGuid}.`, true);
    const loc = res.locations?.[item.url_location];
    const host = loc?.hosts[0];
    if (!loc || !host) throw new SourceAccessError(`Emplacement iCloud inconnu pour ${photoGuid}.`, true);
    const url = `${loc.scheme}://${host}${item.url_path}`;
    if (!this.trustUrl(url)) throw new SourceAccessError(`URL de téléchargement hors iCloud refusée : ${host}`, false);
    return url;
  }

  async resolveDownload(item: RemoteItem): Promise<DownloadRequest> {
    const guid = item.meta?.photoGuid as string | undefined;
    const checksum = item.meta?.checksum as string | undefined;
    if (!guid || !checksum) throw new SourceAccessError(`Élément iCloud sans dérivée téléchargeable (${item.externalId}).`, false);
    const url = await this.urlForChecksum(guid, checksum);
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    return { url, filenameHint: /\.[A-Za-z0-9]{2,5}$/.test(last) ? last : undefined };
  }

  async resolveThumbnail(item: RemoteItem): Promise<DownloadRequest | null> {
    const guid = item.meta?.photoGuid as string | undefined;
    const checksum = item.meta?.posterChecksum as string | undefined;
    if (!guid || !checksum) return null;
    try {
      return { url: await this.urlForChecksum(guid, checksum) };
    } catch {
      return null;
    }
  }
}

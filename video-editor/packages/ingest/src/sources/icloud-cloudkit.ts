import type { DownloadRequest, FetchLike, MediaSource, RemoteItem, SourceListing } from "../types.js";
import { SourceAccessError } from "../types.js";
import { guessKind, requestJson } from "../http.js";
import { isTrustedIcloudUrl } from "./icloud-hosts.js";

/**
 * iCloud via CloudKit : « Lien iCloud » (share.icloud.com/photos/…, les
 * ORIGINAUX, valable 30 jours) et albums partagés nouvelle génération
 * (photos.icloud.com/shared/album/…).
 *
 * API web NON documentée par Apple (celle qu'utilise la page icloud.com) :
 *   1. POST https://ckdatabasews.icloud.com/database/1/com.apple.photos.cloud/production/public/records/resolve
 *        {"shortGUIDs":[{"value":"<id>"}]}
 *      → jeton d'accès anonyme + partition + zone du partage
 *   2. POST <partition>/database/1/com.apple.photos.cloud/production/shared/records/query
 *        (paginé par continuationMarker) → enregistrements CPLAsset + CPLMaster,
 *      dont les champs res*Res portent directement des downloadURL signées
 *      (expiration ≈ 1 h : on relit la liste si elle a vieilli).
 *
 * Si Apple change ce contrat ou exige une connexion (`requireAppleLogin`),
 * l'import échoue avec un message explicite — l'alternative documentée
 * est un dossier Google Drive partagé.
 */

const CONTAINER_PATH = "/database/1/com.apple.photos.cloud/production";
const DEFAULT_CK_BASE = "https://ckdatabasews.icloud.com";
// Ordre d'essai : le premier est celui utilisé par icloud.com pour les albums partagés.
const QUERY_RECORD_TYPES = [
  "CPLAssetAndMasterByAssetDateWithoutHiddenOrDeleted",
  "CPLAssetAndMasterByAddedDate",
  "CPLAssetAndMasterByAssetDate",
];
const URL_TTL_MS = 40 * 60 * 1000;

interface CkAssetValue {
  downloadURL?: string;
  size?: number;
  fileChecksum?: string;
}

interface CkField {
  value?: unknown;
  type?: string;
}

interface CkRecord {
  recordName: string;
  recordType: string;
  fields?: Record<string, CkField>;
  created?: { timestamp?: number };
}

interface ResolveResult {
  serverErrorCode?: string;
  reason?: string;
  requireAppleLogin?: boolean;
  anonymousPublicAccess?: { token?: string; databasePartition?: string };
  zoneID?: Record<string, unknown>;
  share?: { fields?: Record<string, CkField> };
  rootRecord?: CkRecord;
  ancestorRecords?: CkRecord[];
}

interface QueryResponse {
  records?: CkRecord[];
  continuationMarker?: string;
  serverErrorCode?: string;
  reason?: string;
}

export interface CloudKitOptions {
  fetchImpl?: FetchLike;
  /** Tests uniquement : remplace https://ckdatabasews.icloud.com. */
  ckBaseOverride?: string;
  /** Tests uniquement : accepte une partition hors *.icloud.com. */
  trustPartition?: (url: string) => boolean;
  trustUrl?: (url: string) => boolean;
}

function decodeFilename(field: CkField | undefined): string | undefined {
  const v = field?.value;
  if (typeof v !== "string" || !v) return undefined;
  if (field?.type === "STRING") return v;
  try {
    const decoded = Buffer.from(v, "base64").toString("utf-8");
    // Un nom décodé valide est imprimable et a une extension.
    if (/^[^\u0000-\u001f]+\.[A-Za-z0-9]{2,5}$/.test(decoded)) return decoded;
  } catch {
    /* pas du base64 */
  }
  return /\.[A-Za-z0-9]{2,5}$/.test(v) ? v : undefined;
}

function assetField(rec: CkRecord, name: string): CkAssetValue | undefined {
  const v = rec.fields?.[name]?.value;
  return v && typeof v === "object" && "downloadURL" in (v as object) ? (v as CkAssetValue) : undefined;
}

function numField(rec: CkRecord | undefined, name: string): number | undefined {
  const v = rec?.fields?.[name]?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function itemTypeKind(itemType: string | undefined, rec: CkRecord): "video" | "photo" | undefined {
  const t = (itemType ?? "").toLowerCase();
  if (t.includes("movie") || t.includes("mpeg-4") || t.includes("video") || t.includes("m4v")) return "video";
  if (t.includes("jpeg") || t.includes("heic") || t.includes("heif") || t.includes("png") || t.includes("image") || t.includes("tiff") || t.includes("raw")) return "photo";
  if (Object.keys(rec.fields ?? {}).some((k) => /^resVid(Full|Med|Small)Res$/.test(k))) return "video";
  return undefined;
}

const MIME_BY_UTI: Record<string, string> = {
  "public.jpeg": "image/jpeg",
  "public.heic": "image/heic",
  "public.heif": "image/heif",
  "public.png": "image/png",
  "com.apple.quicktime-movie": "video/quicktime",
  "public.mpeg-4": "video/mp4",
};

export class IcloudCloudKitSource implements MediaSource {
  readonly provider: "icloud_shared_collection" | "icloud_link";
  private readonly fetchImpl: FetchLike;
  private readonly ckBase: string;
  private readonly trustUrl: (url: string) => boolean;
  private readonly trustPartition: (url: string) => boolean;
  /** Dernière liste (avec URLs signées) et sa date, pour rafraîchir les URLs expirées. */
  private cache: { at: number; byId: Map<string, RemoteItem> } | null = null;
  private refreshing: Promise<SourceListing> | null = null;

  constructor(
    private readonly shareId: string,
    provider: "icloud_shared_collection" | "icloud_link",
    opts: CloudKitOptions = {}
  ) {
    this.provider = provider;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.ckBase = opts.ckBaseOverride ?? DEFAULT_CK_BASE;
    this.trustUrl = opts.trustUrl ?? isTrustedIcloudUrl;
    this.trustPartition = opts.trustPartition ?? ((u) => /^https:\/\/p\d+-ckdatabasews\.icloud\.com(:443)?\/?$/.test(u));
  }

  private qs(extra: Record<string, string> = {}): string {
    const params = new URLSearchParams({ remapEnums: "true", getCurrentSyncToken: "true", sharing_url_key: this.shareId, ...extra });
    return params.toString();
  }

  private async resolve(): Promise<ResolveResult> {
    const { body } = await requestJson<{ results?: ResolveResult[] }>(
      this.fetchImpl,
      `${this.ckBase}${CONTAINER_PATH}/public/records/resolve?${this.qs()}`,
      {
        method: "POST",
        headers: { "content-type": "text/plain;charset=UTF-8", origin: "https://www.icloud.com" },
        body: JSON.stringify({ shortGUIDs: [{ value: this.shareId }] }),
      }
    );
    const r = body.results?.[0];
    if (!r) throw new SourceAccessError("iCloud n'a rien renvoyé pour ce lien (lien expiré ou supprimé ?).", false);
    if (r.serverErrorCode) {
      const expired = r.serverErrorCode === "NOT_FOUND" || r.serverErrorCode === "GONE";
      throw new SourceAccessError(
        expired
          ? "Lien iCloud introuvable ou expiré (un lien iCloud Photos expire au bout de 30 jours) — demande un nouveau lien au client."
          : `iCloud refuse l'accès : ${r.serverErrorCode}${r.reason ? ` (${r.reason})` : ""}.`,
        false
      );
    }
    if (r.requireAppleLogin) {
      throw new SourceAccessError(
        "Ce lien iCloud exige une connexion Apple (partage restreint) : accès automatisé impossible. Demande un lien public ou un dossier Google Drive.",
        false
      );
    }
    return r;
  }

  async list(): Promise<SourceListing> {
    if (!this.refreshing) {
      this.refreshing = this.doList().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doList(): Promise<SourceListing> {
    const share = await this.resolve();
    const titleField = share.share?.fields?.["cloudkit.title"]?.value;
    const title = typeof titleField === "string" ? titleField : undefined;
    const records: CkRecord[] = [];

    const token = share.anonymousPublicAccess?.token;
    const partition = share.anonymousPublicAccess?.databasePartition;
    if (token && partition && share.zoneID) {
      if (!this.trustPartition(partition)) throw new SourceAccessError(`Partition iCloud inattendue refusée : ${partition}`, false);
      records.push(...(await this.queryAll(partition.replace(/\/$/, ""), token, share.zoneID)));
    }
    // Lien vers un seul élément : l'enregistrement est déjà dans la réponse de resolve.
    if (records.length === 0) {
      if (share.rootRecord) records.push(share.rootRecord);
      records.push(...(share.ancestorRecords ?? []));
    }
    const items = this.toItems(records);
    if (items.length === 0) {
      throw new SourceAccessError(
        "Lien iCloud lisible mais aucun fichier téléchargeable n'a été trouvé (format de partage non pris en charge ou modifié par Apple). Utilise un dossier Google Drive en alternative.",
        false
      );
    }
    this.cache = { at: Date.now(), byId: new Map(items.map((i) => [i.externalId, i])) };
    return { title, items };
  }

  private async queryAll(partition: string, token: string, zoneID: Record<string, unknown>): Promise<CkRecord[]> {
    let lastErr: unknown;
    for (const recordType of QUERY_RECORD_TYPES) {
      try {
        const out: CkRecord[] = [];
        let marker: string | undefined;
        for (let page = 0; page < 500; page++) {
          const { body } = await requestJson<QueryResponse>(
            this.fetchImpl,
            `${partition}${CONTAINER_PATH}/shared/records/query?${this.qs({ publicAccessAuthToken: token })}`,
            {
              method: "POST",
              headers: { "content-type": "text/plain;charset=UTF-8", origin: "https://www.icloud.com" },
              body: JSON.stringify({
                query: {
                  recordType,
                  filterBy: [{ fieldName: "direction", comparator: "EQUALS", fieldValue: { value: "ASCENDING", type: "STRING" } }],
                },
                zoneID,
                resultsLimit: 200,
                ...(marker ? { continuationMarker: marker } : {}),
              }),
            }
          );
          if (body.serverErrorCode) throw new SourceAccessError(`Requête iCloud refusée : ${body.serverErrorCode} ${body.reason ?? ""}`, false);
          out.push(...(body.records ?? []));
          marker = body.continuationMarker;
          if (!marker) break;
        }
        return out;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new SourceAccessError("Requête iCloud impossible.", true);
  }

  private toItems(records: CkRecord[]): RemoteItem[] {
    const masters = new Map<string, CkRecord>();
    const assets: CkRecord[] = [];
    for (const r of records) {
      if (r.recordType === "CPLMaster") masters.set(r.recordName, r);
      else if (r.recordType === "CPLAsset") assets.push(r);
    }
    const pairs: { master: CkRecord; asset?: CkRecord }[] = [];
    const used = new Set<string>();
    for (const a of assets) {
      const ref = a.fields?.masterRef?.value as { recordName?: string } | undefined;
      const m = ref?.recordName ? masters.get(ref.recordName) : undefined;
      if (m && !used.has(m.recordName)) {
        pairs.push({ master: m, asset: a });
        used.add(m.recordName);
      }
    }
    for (const m of masters.values()) if (!used.has(m.recordName)) pairs.push({ master: m });

    const items: RemoteItem[] = [];
    for (const { master, asset } of pairs) {
      const original = assetField(master, "resOriginalRes");
      if (!original?.downloadURL) continue;
      const itemType = master.fields?.itemType?.value as string | undefined;
      const filename = decodeFilename(master.fields?.filenameEnc) ?? `${master.recordName}.${itemType?.split(".").pop() ?? "bin"}`;
      const kind = itemTypeKind(itemType, master) ?? guessKind(filename);
      const thumb = assetField(master, "resJPEGThumbRes") ?? assetField(master, "resJPEGMedRes");
      const assetDate = numField(asset, "assetDate");
      const durationRaw = numField(asset, "duration") ?? numField(master, "duration");
      items.push({
        externalId: master.recordName,
        filename,
        kind,
        mimeType: itemType ? MIME_BY_UTI[itemType] : undefined,
        sizeBytes: original.size,
        width: numField(master, "resOriginalWidth"),
        height: numField(master, "resOriginalHeight"),
        // Durée déclarée, revérifiée par ffprobe après téléchargement.
        durationSec: durationRaw !== undefined && kind === "video" ? durationRaw : undefined,
        takenAt: assetDate ? new Date(assetDate).toISOString() : undefined,
        meta: { originalUrl: original.downloadURL, thumbUrl: thumb?.downloadURL },
      });
    }
    return items;
  }

  private fillUrl(template: string, filename: string): string {
    const url = template.replace(/\$\{f\}/g, encodeURIComponent(filename));
    if (!this.trustUrl(url)) throw new SourceAccessError(`URL de téléchargement hors iCloud refusée : ${new URL(url).host}`, false);
    return url;
  }

  /** Item avec URLs fraîches (relit le partage si la liste a plus de 40 min). */
  private async fresh(item: RemoteItem): Promise<RemoteItem> {
    if (this.cache && Date.now() - this.cache.at < URL_TTL_MS) return this.cache.byId.get(item.externalId) ?? item;
    await this.list();
    const refreshed = this.cache?.byId.get(item.externalId);
    if (!refreshed) throw new SourceAccessError(`Fichier retiré du partage iCloud depuis le listage (${item.filename}).`, false);
    return refreshed;
  }

  async resolveDownload(item: RemoteItem): Promise<DownloadRequest> {
    const it = await this.fresh(item);
    const tpl = it.meta?.originalUrl as string | undefined;
    if (!tpl) throw new SourceAccessError(`Pas d'original téléchargeable pour ${item.filename}.`, false);
    return { url: this.fillUrl(tpl, it.filename) };
  }

  async resolveThumbnail(item: RemoteItem): Promise<DownloadRequest | null> {
    const it = await this.fresh(item);
    const tpl = it.meta?.thumbUrl as string | undefined;
    if (!tpl) return null;
    return { url: this.fillUrl(tpl, "thumb.jpg") };
  }
}

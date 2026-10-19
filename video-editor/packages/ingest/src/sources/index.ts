import type { FetchLike, MediaSource, ShareLink } from "../types.js";
import { IcloudSharedStreamsSource } from "./icloud-sharedstreams.js";
import { IcloudCloudKitSource } from "./icloud-cloudkit.js";
import { GoogleDriveSource } from "./google-drive.js";

export { IcloudSharedStreamsSource, sharedStreamsPartition } from "./icloud-sharedstreams.js";
export { IcloudCloudKitSource } from "./icloud-cloudkit.js";
export { GoogleDriveSource } from "./google-drive.js";
export { isTrustedIcloudUrl } from "./icloud-hosts.js";

export interface SourceFactoryOptions {
  fetchImpl?: FetchLike;
  googleDriveApiKey?: string;
}

/** Une source par fournisseur — ajouter Dropbox/WeTransfer = ajouter un cas ici. */
export function createMediaSource(link: ShareLink, opts: SourceFactoryOptions = {}): MediaSource {
  switch (link.provider) {
    case "icloud_shared_album":
      return new IcloudSharedStreamsSource(link.token, { fetchImpl: opts.fetchImpl });
    case "icloud_shared_collection":
    case "icloud_link":
      return new IcloudCloudKitSource(link.token, link.provider, { fetchImpl: opts.fetchImpl });
    case "google_drive":
      return new GoogleDriveSource(link.token, {
        apiKey: opts.googleDriveApiKey,
        resourceKey: link.resourceKey,
        isSingleFile: link.isSingleFile,
        fetchImpl: opts.fetchImpl,
      });
  }
}

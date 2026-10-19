import type { ShareLink } from "./types.js";

/**
 * Reconnaît un lien de partage collé par un client. Fichier sans
 * dépendance : importable par les routes Next.js pour valider le lien
 * avant de créer l'import. Formats acceptés :
 *
 *  - iCloud « Album partagé » (ancien flux sharedstreams) :
 *      https://www.icloud.com/sharedalbum/#B0aGWZuqDGKPZvv
 *      https://www.icloud.com/sharedalbum/fr-fr/#B0aGWZuqDGKPZvv
 *  - iCloud « Album partagé » nouvelle génération (CloudKit) :
 *      https://photos.icloud.com/shared/album/<id>/
 *  - iCloud « Lien iCloud » (Photos → Partager → Copier le lien iCloud) :
 *      https://share.icloud.com/photos/0aBcD…
 *      https://www.icloud.com/photos/#0aBcD…  (et #/0aBcD…)
 *  - Google Drive (dossier ou fichier partagé « tous les utilisateurs disposant du lien ») :
 *      https://drive.google.com/drive/folders/<id>?resourcekey=…
 *      https://drive.google.com/drive/u/0/folders/<id>
 *      https://drive.google.com/file/d/<id>/view
 *      https://drive.google.com/open?id=<id>
 */
export function parseShareUrl(raw: string): ShareLink {
  const input = raw.trim();
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Lien invalide — colle l'adresse complète (https://…).");
  }
  if (url.protocol !== "https:") throw new Error("Seuls les liens https:// sont acceptés.");
  const host = url.hostname.toLowerCase();
  const fragment = decodeURIComponent(url.hash.replace(/^#\/?/, ""));

  if (host === "www.icloud.com" || host === "icloud.com") {
    if (url.pathname.startsWith("/sharedalbum")) {
      const token = fragment.split(/[;/?]/)[0] ?? "";
      if (!/^[A-Za-z0-9]{10,}$/.test(token)) throw new Error("Lien d'album partagé iCloud incomplet (jeton après # manquant).");
      return { provider: "icloud_shared_album", token, normalizedUrl: `https://www.icloud.com/sharedalbum/#${token}` };
    }
    if (url.pathname.startsWith("/photos")) {
      const token = fragment.split(/[;/?]/)[0] ?? "";
      if (!/^[A-Za-z0-9_-]{10,}$/.test(token)) throw new Error("Lien iCloud Photos incomplet (identifiant après # manquant).");
      return { provider: "icloud_link", token, normalizedUrl: `https://share.icloud.com/photos/${token}` };
    }
  }

  if (host === "share.icloud.com") {
    const m = /^\/photos\/([A-Za-z0-9_-]{10,})/.exec(url.pathname);
    if (!m) throw new Error("Lien share.icloud.com non reconnu (attendu : /photos/<identifiant>).");
    return { provider: "icloud_link", token: m[1]!, normalizedUrl: `https://share.icloud.com/photos/${m[1]}` };
  }

  if (host === "photos.icloud.com") {
    const m = /^\/shared\/album\/([A-Za-z0-9_-]{6,})/.exec(url.pathname);
    if (!m) throw new Error("Lien photos.icloud.com non reconnu (attendu : /shared/album/<identifiant>).");
    return { provider: "icloud_shared_collection", token: m[1]!, normalizedUrl: `https://photos.icloud.com/shared/album/${m[1]}/` };
  }

  if (host === "drive.google.com") {
    const resourceKey = url.searchParams.get("resourcekey") ?? undefined;
    const folder = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(url.pathname);
    if (folder) {
      return {
        provider: "google_drive",
        token: folder[1]!,
        resourceKey,
        normalizedUrl: `https://drive.google.com/drive/folders/${folder[1]}`,
      };
    }
    const file = /\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(url.pathname);
    const openId = url.searchParams.get("id");
    const fileId = file?.[1] ?? (openId && /^[A-Za-z0-9_-]{10,}$/.test(openId) ? openId : null);
    if (fileId) {
      return {
        provider: "google_drive",
        token: fileId,
        resourceKey,
        isSingleFile: Boolean(file) || url.pathname.startsWith("/open"),
        normalizedUrl: `https://drive.google.com/file/d/${fileId}/view`,
      };
    }
    throw new Error("Lien Google Drive non reconnu (attendu : un dossier ou un fichier partagé).");
  }

  throw new Error("Source non prise en charge — colle un lien iCloud Photos ou Google Drive.");
}

export const PROVIDER_LABEL_FR: Record<ShareLink["provider"], string> = {
  icloud_shared_album: "iCloud — album partagé",
  icloud_shared_collection: "iCloud — album partagé (nouvelle génération)",
  icloud_link: "iCloud — lien de partage",
  google_drive: "Google Drive",
};

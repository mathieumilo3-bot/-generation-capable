import type { BlobStore } from "./blobs.ts";
import type { Store } from "./store.ts";

type Log = (level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) => void;

/**
 * Politique de conservation (24 h maximum, réglable dans `app_settings.retention.*_hours`) :
 *  1. marque les fichiers envoyés trop anciens (jamais ceux d'un job actif) ;
 *  2. supprime du Storage les fichiers marqués et les vidéos/miniatures expirées, puis efface les chemins en base ;
 *  3. prévient les utilisateurs quelques heures avant la suppression de leur vidéo.
 * Chaque suppression est idempotente : un objet déjà absent n'est pas une erreur, une panne est réessayée au passage suivant.
 */
export async function runRetention(store: Store, blobs: BlobStore, o: { log?: Log; warnHoursBefore?: number; batch?: number } = {}): Promise<{ assets: number; versions: number; warned: number }> {
  const batch = o.batch ?? 100;
  const marked = await store.expireContent();
  if (marked.assets_marked > 0) o.log?.("info", "fichiers envoyés expirés", { n: marked.assets_marked });

  let assets = 0;
  for (const a of await store.assetsToPurge(batch)) {
    try { await blobs.remove(a.bucket, a.path); } catch (e) { if (!/not.?found|404/i.test((e as Error).message)) { o.log?.("warn", "suppression fichier impossible", { path: a.path, error: (e as Error).message }); continue; } }
    await store.assetPurged(a.asset_id);
    assets++;
  }

  let versions = 0;
  for (const v of await store.versionsToPurge(batch)) {
    try {
      if (v.render_path) await blobs.remove("renders", v.render_path);
      if (v.thumbnail_path) await blobs.remove("thumbnails", v.thumbnail_path);
    } catch (e) {
      if (!/not.?found|404/i.test((e as Error).message)) { o.log?.("warn", "suppression vidéo impossible", { version: v.version_id, error: (e as Error).message }); continue; }
    }
    await store.versionPurged(v.version_id);
    versions++;
  }
  const warned = await store.notifyExpiring(o.warnHoursBefore ?? 3);
  return { assets, versions, warned };
}

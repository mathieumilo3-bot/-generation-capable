import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";
import { supabaseTusTransport, UploadManager, type FileRef, type FileSource } from "@app/api";
import { api, supabase } from "./supabase";
import { env } from "./env";

/** Web : File/Blob direct. Mobile : fetch(uri).blob() — Blob adossé au fichier natif, jamais copié en mémoire JS. */
async function resolveSource(file: Omit<FileRef, "blob"> & { blob?: Blob }): Promise<FileSource> {
  let blob: Blob | undefined = file.blob;
  if (!blob) {
    if (!file.uri) throw Object.assign(new Error("file_unavailable"), { code: "file_unavailable" });
    blob = await (await fetch(file.uri)).blob();
  }
  const b = blob;
  return { size: b.size || file.size, slice: (s, e) => b.slice(s, e) };
}

export const uploadManager = new UploadManager({
  store: AsyncStorage,
  concurrency: 2,
  resolveSource,
  registerAsset: async ({ projectId, kind, file }) => {
    const r = await api.assets.register({ projectId, kind, filename: file.name, mimeType: file.mime, sizeBytes: file.size, durationSec: file.durationSec });
    return r.ok ? { ok: true, assetId: String(r.asset_id), bucket: String(r.bucket), path: String(r.path) } : { ok: false, code: r.code };
  },
  completeAsset: async (id) => { const r = await api.assets.complete(id); return r.ok ? { ok: true } : { ok: false, code: r.code }; },
  removeAsset: (id) => api.assets.remove(id),
  transport: supabaseTusTransport(supabase, { projectUrl: env.supabaseUrl, publishableKey: env.supabasePublishableKey }),
});

// Réseau : pause automatique hors ligne, reprise au retour (sans intervention de l'utilisateur).
NetInfo.addEventListener((s) => uploadManager.setOnline(s.isConnected !== false && s.isInternetReachable !== false));
void uploadManager.restore();
export const uploadsSupported = Platform.OS !== "web" || typeof Blob !== "undefined";

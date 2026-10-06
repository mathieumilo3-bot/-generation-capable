import type { SupabaseClient } from "@supabase/supabase-js";
import { tusUpload } from "./tus";
import type { UploadDeps } from "./manager";

/**
 * Transport TUS vers Supabase Storage. Hôte direct `*.storage.supabase.co` si
 * fourni (recommandé par Supabase pour les gros fichiers), sinon l'URL projet.
 */
export function supabaseTusTransport(sb: SupabaseClient, o: { projectUrl: string; storageUrl?: string; publishableKey: string }): UploadDeps["transport"] {
  const base = (o.storageUrl ?? o.projectUrl).replace(/\/$/, "");
  const endpoint = `${base}/storage/v1/upload/resumable`;
  return async ({ source, bucket, path, mime, resumeUrl, onUrl, onProgress, signal }) => {
    await tusUpload({
      file: source, endpoint, resumeUrl, onUrl, signal,
      onProgress: (b) => onProgress(b),
      metadata: { bucketName: bucket, objectName: path, contentType: mime, cacheControl: "3600" },
      // Le jeton est relu à chaque requête : un refresh pendant un long envoi est pris en compte.
      headers: async () => {
        const { data } = await sb.auth.getSession();
        return { authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: o.publishableKey, "x-upsert": "false" };
      },
    });
  };
}

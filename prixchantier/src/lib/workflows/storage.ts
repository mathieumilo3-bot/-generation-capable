import "server-only";
import { adminClient } from "@/lib/supabase/admin";

export const BUCKET = "files";

export async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await adminClient().storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Fichier introuvable dans le stockage (${error?.message ?? "vide"})`);
  return Buffer.from(await data.arrayBuffer());
}

export async function uploadFile(path: string, content: Buffer, contentType: string) {
  const { error } = await adminClient().storage.from(BUCKET).upload(path, content, { contentType, upsert: false });
  if (error) throw new Error(`Échec d'enregistrement du fichier : ${error.message}`);
}

/** URL signée de courte durée (jamais de lien public). */
export async function signedUrl(path: string, downloadName?: string, seconds = 120) {
  const { data, error } = await adminClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, seconds, downloadName ? { download: downloadName } : undefined);
  if (error || !data) throw new Error("Lien de téléchargement indisponible");
  return data.signedUrl;
}

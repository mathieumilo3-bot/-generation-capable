"use client";

import { createBrowserSupabase } from "@/lib/supabase/browser";
import { prepareUploads, registerDocuments, startAnalysis } from "@/actions/projects";
import type { PickedFile } from "@/components/file-uploader";

/**
 * Envoie les fichiers directement dans le stockage (URL signées préparées
 * par le serveur), les enregistre, puis lance l'analyse côté serveur.
 */
export async function uploadAndAnalyze(
  projectId: string,
  files: PickedFile[],
  onProgress: (label: string) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prepared = await prepareUploads(
    projectId,
    files.map((f) => ({ name: f.file.name, size: f.file.size, kind: f.kind })),
  );
  if (!prepared.ok) return prepared;
  const supabase = createBrowserSupabase();
  const done: { path: string; name: string; kind: PickedFile["kind"] }[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress(`Envoi des fichiers (${i + 1}/${files.length})…`);
    const target = prepared.data[i];
    const { error } = await supabase.storage.from("files").uploadToSignedUrl(target.path, target.token, files[i].file, {
      contentType: files[i].file.type || undefined,
    });
    if (error) return { ok: false, error: `Envoi de « ${files[i].file.name} » impossible. Réessayez.` };
    done.push({ path: target.path, name: files[i].file.name, kind: files[i].kind });
  }
  onProgress("Enregistrement…");
  const registered = await registerDocuments(projectId, done);
  if (!registered.ok) return registered;
  if (!files.some((f) => f.kind === "dpgf")) return { ok: true };
  onProgress("Lancement de l'analyse…");
  const started = await startAnalysis(projectId);
  if (!started.ok) return started;
  return { ok: true };
}

import { Platform, Share } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library/legacy";
import { api } from "@/lib/supabase";

/** Télécharger / partager la vidéo finale (URL signée courte ; jamais de fichier public). */
export interface ActionOutcome {
  kind: "saved" | "shared" | "started" | "copied" | "cancelled";
  message: string;
}

const SHARE_LINK_TTL_SEC = 24 * 3600;

/** Télécharge le rendu dans le cache de l'app (natif). */
async function fetchToCache(renderPath: string, fileName: string): Promise<File> {
  const url = await api.projects.signedUrl("renders", renderPath, { expiresIn: 900 });
  return File.downloadFileAsync(url, new File(Paths.cache, fileName), { idempotent: true });
}

async function shareFile(uri: string, title: string): Promise<boolean> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "video/mp4", UTI: "public.mpeg-4", dialogTitle: title });
    return true;
  }
  const res = await Share.share({ url: uri, title });
  return res.action === Share.sharedAction;
}

export async function downloadVideo(renderPath: string, fileName: string): Promise<ActionOutcome> {
  if (Platform.OS === "web") {
    const url = await api.projects.signedUrl("renders", renderPath, { expiresIn: 900, download: fileName });
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { kind: "started", message: "Le téléchargement a commencé." };
  }
  const file = await fetchToCache(renderPath, fileName);
  // La permission galerie n'est demandée qu'ici, au moment d'enregistrer (écriture seule).
  try {
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (perm.granted) {
      await MediaLibrary.saveToLibraryAsync(file.uri);
      return { kind: "saved", message: "Votre vidéo est enregistrée dans votre galerie." };
    }
  } catch { /* galerie indisponible : on propose le partage ci-dessous */ }
  const shared = await shareFile(file.uri, "Enregistrer la vidéo");
  return shared
    ? { kind: "shared", message: "Vidéo prête à être enregistrée." }
    : { kind: "cancelled", message: "Enregistrement annulé." };
}

export async function shareVideo(renderPath: string, fileName: string, title: string): Promise<ActionOutcome> {
  if (Platform.OS === "web") {
    const url = await api.projects.signedUrl("renders", renderPath, { expiresIn: SHARE_LINK_TTL_SEC });
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try { await navigator.share({ title, url }); return { kind: "shared", message: "Lien partagé." }; }
      catch (e) { if ((e as { name?: string }).name === "AbortError") return { kind: "cancelled", message: "Partage annulé." }; }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      return { kind: "copied", message: "Lien copié. Il reste valable 24 heures." };
    }
    throw Object.assign(new Error("share_unavailable"), { code: "unknown" });
  }
  const file = await fetchToCache(renderPath, fileName);
  const shared = await shareFile(file.uri, title);
  return shared ? { kind: "shared", message: "Vidéo partagée." } : { kind: "cancelled", message: "Partage annulé." };
}

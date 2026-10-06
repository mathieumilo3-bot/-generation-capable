import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type { FileRef } from "@app/api";

/**
 * Sélection de fichiers. La permission « photos » n'est demandée QUE lorsque l'utilisateur
 * touche « Galerie » (§56) ; le sélecteur système iOS/Android n'exige aucune permission pour les fichiers.
 */
export async function pickFromGallery(opts: { multiple?: boolean; types?: ("videos" | "images")[] } = {}): Promise<FileRef[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: opts.types ?? ["videos"], allowsMultipleSelection: opts.multiple ?? true, selectionLimit: 20,
    videoMaxDuration: 0, quality: 1, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  });
  if (res.canceled) return [];
  return res.assets.map((a) => ({
    name: a.fileName ?? `video-${Date.now()}.${a.type === "image" ? "jpg" : "mp4"}`,
    size: a.fileSize ?? 0,
    mime: a.mimeType ?? (a.type === "image" ? "image/jpeg" : "video/mp4"),
    uri: a.uri,
    blob: Platform.OS === "web" ? (a.file as Blob | undefined) : undefined,
    durationSec: a.duration ? a.duration / 1000 : null,
  })).filter((f) => f.size > 0);
}

export async function pickFiles(opts: { types?: string[]; multiple?: boolean } = {}): Promise<FileRef[]> {
  const res = await DocumentPicker.getDocumentAsync({ type: opts.types ?? ["video/*"], multiple: opts.multiple ?? true, copyToCacheDirectory: false });
  if (res.canceled) return [];
  return res.assets.map((a) => ({
    name: a.name, size: a.size ?? 0, mime: a.mimeType ?? "video/mp4", uri: a.uri,
    blob: Platform.OS === "web" ? (a.file as Blob | undefined) : undefined,
  })).filter((f) => f.size > 0);
}

export async function captureVideo(): Promise<FileRef[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();   // demandée seulement ici
  if (!perm.granted) return [];
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"], videoMaxDuration: 0, quality: 1 });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ name: a.fileName ?? `camera-${Date.now()}.mp4`, size: a.fileSize ?? 0, mime: a.mimeType ?? "video/mp4", uri: a.uri, durationSec: a.duration ? a.duration / 1000 : null })).filter((f) => f.size > 0);
}

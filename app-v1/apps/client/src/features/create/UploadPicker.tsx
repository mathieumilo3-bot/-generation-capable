import React, { useState } from "react";
import { Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Notice, Text, colors, spacing } from "@app/ui";
import type { FileRef } from "@app/api";
import { captureVideo, pickFiles, pickFromGallery } from "@/lib/media";

/**
 * Grand bloc d'ajout : Galerie / Fichiers / Caméra. Les permissions ne sont demandées qu'au toucher
 * (galerie : sélecteur système ; caméra : demandée dans `captureVideo`).
 */
export function UploadPicker({ onFiles, title, hint, kind = "video", multiple = true, compact }: {
  onFiles: (files: FileRef[]) => void | Promise<void>;
  title?: string; hint?: string; kind?: "video" | "image"; multiple?: boolean; compact?: boolean;
}) {
  const [busy, setBusy] = useState<"gallery" | "files" | "camera" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const isImage = kind === "image";

  const run = async (which: "gallery" | "files" | "camera", pick: () => Promise<FileRef[]>) => {
    if (busy) return;
    setBusy(which); setProblem(null);
    try {
      const files = await pick();
      if (files.length > 0) await onFiles(files);
    } catch {
      setProblem(which === "camera" ? "Impossible d'ouvrir la caméra. Vérifiez l'autorisation dans les réglages de votre appareil." : "Impossible d'ouvrir la sélection. Vérifiez l'autorisation dans les réglages de votre appareil.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Card tone="surface" padded={false} style={{ padding: compact ? spacing.lg : spacing.xxl, gap: spacing.lg, alignItems: "center" }}>
        {!compact ? (
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={isImage ? "images-outline" : "cloud-upload-outline"} size={30} color={colors.accent} />
          </View>
        ) : null}
        <View style={{ gap: 4, alignItems: "center" }}>
          <Text variant="section" align="center">{title ?? (isImage ? "Ajoutez vos images" : "Ajoutez vos vidéos")}</Text>
          {hint ? <Text variant="secondary" color="textSecondary" align="center">{hint}</Text> : null}
        </View>
        <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
          <Button label="Galerie" icon={<Ionicons name="images-outline" size={20} color={colors.onAccent} />} loading={busy === "gallery"} disabled={!!busy}
            onPress={() => void run("gallery", () => pickFromGallery({ multiple, types: [isImage ? "images" : "videos"] }))} />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button label="Fichiers" variant="secondary" fullWidth={false} style={{ flex: 1 }} loading={busy === "files"} disabled={!!busy}
              onPress={() => void run("files", () => pickFiles({ types: [isImage ? "image/*" : "video/*"], multiple }))} />
            {Platform.OS !== "web" && !isImage ? (
              <Button label="Caméra" variant="secondary" fullWidth={false} style={{ flex: 1 }} loading={busy === "camera"} disabled={!!busy}
                onPress={() => void run("camera", () => captureVideo())} />
            ) : null}
          </View>
        </View>
      </Card>
      {problem ? <Notice tone="warning" icon="alert-circle-outline" title={problem} /> : null}
    </View>
  );
}

import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { Button, Notice, Text, colors, spacing } from "@app/ui";
import { formatDuration } from "@app/domain";
import type { FileRef } from "@app/api";
import { uploadManager } from "@/lib/uploads";
import { FileRows } from "./FileRows";
import { useDraftFiles } from "./useDraftFiles";
import type { FileRow } from "./logic";
import { api } from "@/lib/supabase";

const NOTE = ["audio_note"] as const;
const MAX_SECONDS = 120;

/**
 * Note vocale jointe. La transcription n'existe pas encore côté serveur : l'enregistrement est envoyé tel quel
 * comme pièce jointe (asset « audio_note ») et un texte écrit reste exigé par l'écran appelant.
 * La permission micro n'est demandée qu'au toucher de « Enregistrer ».
 */
export function VoiceNote({ projectId }: { projectId: string }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const files = useDraftFiles(projectId, NOTE);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (busy || state.isRecording) return;
    setProblem(null); setBusy(true);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { setProblem("Autorisez le micro dans les réglages de votre appareil pour enregistrer une note vocale."); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setProblem("L'enregistrement n'a pas pu démarrer. Vérifiez votre micro puis réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      const uri = recorder.uri;
      if (!uri) throw new Error("no_recording");
      const blob = await (await fetch(uri)).blob();
      if (blob.size === 0) throw new Error("empty");
      const mime = (blob.type || "audio/mp4").split(";")[0]!;
      const ext = mime.includes("webm") ? "webm" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "m4a";
      const file: FileRef = { name: `note-vocale-${Date.now()}.${ext}`, size: blob.size, mime, uri, durationSec: state.durationMillis / 1000 };
      for (const old of files.uploads.items.filter((i) => i.kind === "audio_note")) await uploadManager.cancel(old.localId);
      for (const r of files.rows.filter((r) => r.source === "server")) if (r.assetId) await api.assets.remove(r.assetId).catch(() => undefined);
      uploadManager.add(projectId, "audio_note", [web(file, blob)]);
      await files.refresh();
    } catch {
      setProblem("L'enregistrement n'a pas pu être conservé. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (state.isRecording && state.durationMillis >= MAX_SECONDS * 1000) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, state.durationMillis]);

  const remove = async (row: FileRow) => {
    if (row.source === "local" && row.localId) await files.uploads.cancel(row.localId);
    else if (row.assetId) await api.assets.remove(row.assetId).catch(() => undefined);
    await files.refresh();
  };

  return (
    <View style={{ gap: spacing.md }}>
      {state.isRecording ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.accentTint, borderRadius: 16, padding: spacing.lg }} accessibilityLiveRegion="polite">
          <Ionicons name="mic" size={22} color={colors.accentPressed} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>Enregistrement · {formatDuration(state.durationMillis / 1000)}</Text>
          <Button label="Terminer" size="small" fullWidth={false} onPress={() => void stop()} loading={busy} />
        </View>
      ) : (
        <Button label={files.rows.length > 0 ? "Refaire la note vocale" : "Enregistrer une note vocale"} variant="secondary"
          icon={<Ionicons name="mic-outline" size={20} color={colors.text} />} onPress={() => void start()} loading={busy} />
      )}
      <Text variant="caption" color="textSecondary">
        Votre note vocale est jointe à votre demande. Elle n'est pas transformée en texte : écrivez aussi l'essentiel ci-dessus.
      </Text>
      {problem ? <Notice tone="warning" icon="mic-off-outline" title={problem} /> : null}
      <FileRows rows={files.rows} onRetry={(r) => { if (r.localId) files.uploads.retry(r.localId); }} onRemove={(r) => void remove(r)} />
    </View>
  );
}

/** Web : le Blob est conservé pour l'envoi ; mobile : l'URI du fichier suffit. */
function web(file: FileRef, blob: Blob): FileRef {
  return Platform.OS === "web" ? { ...file, blob } : file;
}

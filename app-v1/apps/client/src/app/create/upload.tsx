import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, ProgressBar, Text, spacing } from "@app/ui";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { FlowScreen } from "@/features/create/FlowScreen";
import { UploadPicker } from "@/features/create/UploadPicker";
import { FileRows } from "@/features/create/FileRows";
import { useCreateDraft } from "@/features/create/draft";
import { useDraftFiles } from "@/features/create/useDraftFiles";
import { useAddFiles } from "@/features/create/useAddFiles";
import { summaryLabel, type FileRow } from "@/features/create/logic";
import { analytics } from "@/lib/analytics";
import { api } from "@/lib/supabase";
import { href } from "@/lib/href";

const RAW = ["raw"] as const;

export default function UploadRoute() {
  return <RequireAuth><UploadScreen /></RequireAuth>;
}

function UploadScreen() {
  const { projectId: param } = useLocalSearchParams<{ projectId?: string }>();
  const router = useRouter();
  const draft = useCreateDraft(param);
  const projectId = param ?? null;
  const files = useDraftFiles(projectId, RAW);
  const { add, rejection } = useAddFiles({
    projectId, mode: "edit_rushes", kind: "raw",
    onProjectCreated: (id) => router.setParams({ projectId: id }),
  });

  // Nouveau départ (pas de projet dans l'URL) : on repart d'un brouillon vierge.
  const { reset } = draft;
  const startedFresh = useRef(false);
  useEffect(() => {
    if (startedFresh.current) return;
    startedFresh.current = true;
    if (!param) reset();
  }, [param, reset]);

  const completed = useRef(false);
  useEffect(() => {
    if (files.summary.allDone && !completed.current) {
      completed.current = true;
      analytics.track("upload_completed", { file_count: files.summary.count, total_bytes: files.summary.bytesTotal });
    }
    if (!files.summary.allDone) completed.current = false;
  }, [files.summary.allDone, files.summary.count, files.summary.bytesTotal]);

  const retry = (row: FileRow) => { if (row.localId) files.uploads.retry(row.localId); };
  const remove = async (row: FileRow) => {
    if (row.source === "local" && row.localId) await files.uploads.cancel(row.localId);
    else if (row.assetId) await api.assets.remove(row.assetId).catch(() => undefined);
    await files.refresh();
  };

  const canContinue = projectId !== null && files.rows.some((r) => r.status !== "failed");
  const { summary } = files;

  return (
    <FlowScreen
      title="Ajoutez vos vidéos" step={1} total={4}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button label="Continuer" disabled={!canContinue}
            onPress={() => router.push(href(`/create/duration?projectId=${projectId}`))} />
        </View>
      }
    >
      <UploadPicker
        hint={files.rows.length === 0 ? "Choisissez les vidéos à monter. Nous nous occupons du reste." : "Ajoutez-en d'autres si besoin."}
        onFiles={add}
        compact={files.rows.length > 0}
      />
      {rejection ? <HumanErrorNotice error={rejection} /> : null}
      {files.rows.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong" accessibilityLiveRegion="polite">{summaryLabel(summary)}</Text>
            {summary.anyActive ? <ProgressBar value={summary.fraction} label="Progression de l'envoi" /> : null}
            {summary.anyActive ? <Text variant="secondary" color="textSecondary">Vous pouvez quitter cet écran pendant l'envoi.</Text> : null}
          </View>
          <FileRows rows={files.rows} onRetry={retry} onRemove={(r) => void remove(r)} />
        </View>
      ) : null}
    </FlowScreen>
  );
}

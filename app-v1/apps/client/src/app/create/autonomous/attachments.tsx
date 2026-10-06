import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Button, Input, Text, colors, spacing } from "@app/ui";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { FlowScreen } from "@/features/create/FlowScreen";
import { UploadPicker } from "@/features/create/UploadPicker";
import { FileRows } from "@/features/create/FileRows";
import { useCreateDraft } from "@/features/create/draft";
import { useDraftFiles } from "@/features/create/useDraftFiles";
import { useAddFiles } from "@/features/create/useAddFiles";
import { isValidHttpUrl, normalizeUrl, summaryLabel, type FileRow } from "@/features/create/logic";
import { api } from "@/lib/supabase";
import { href } from "@/lib/href";

const IMAGES = ["image"] as const;
const LOGOS = ["logo"] as const;
const MAX_URLS = 5;

export default function AttachmentsRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  if (!projectId) return <Redirect href={href("/create/autonomous/idea")} />;
  return <RequireAuth><AttachmentsScreen projectId={projectId} /></RequireAuth>;
}

function AttachmentsScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { draft, patch } = useCreateDraft(projectId);
  const images = useDraftFiles(projectId, IMAGES);
  const logos = useDraftFiles(projectId, LOGOS);
  const addImages = useAddFiles({ projectId, mode: "autonomous", kind: "image" });
  const addLogo = useAddFiles({ projectId, mode: "autonomous", kind: "logo" });
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const addUrl = () => {
    const candidate = normalizeUrl(url);
    if (!isValidHttpUrl(candidate)) { setUrlError("Ce lien ne semble pas valide. Exemple : https://monsite.fr"); return; }
    if (draft.urls.includes(candidate)) { setUrl(""); return; }
    patch({ urls: [...draft.urls, candidate].slice(0, MAX_URLS) });
    setUrl(""); setUrlError(null);
  };

  const remove = (f: typeof images) => async (row: FileRow) => {
    if (row.source === "local" && row.localId) await f.uploads.cancel(row.localId);
    else if (row.assetId) await api.assets.remove(row.assetId).catch(() => undefined);
    await f.refresh();
  };

  return (
    <FlowScreen title="Ajoutez vos éléments" subtitle="Tout est facultatif : ajoutez ce qui peut aider à créer votre vidéo." step={2} total={5}
      footer={<Button label="Continuer" onPress={() => router.push(href(`/create/autonomous/objective?projectId=${projectId}`))} />}>
      <View style={{ gap: spacing.md }}>
        <Text variant="section">Un site ou une page</Text>
        <Input label="Lien" placeholder="https://monsite.fr" value={url} onChangeText={(t) => { setUrl(t); setUrlError(null); }}
          autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="done" onSubmitEditing={addUrl} error={urlError} />
        <Button label="Ajouter ce lien" variant="secondary" disabled={url.trim().length === 0 || draft.urls.length >= MAX_URLS} onPress={addUrl} />
        {draft.urls.map((u) => (
          <View key={u} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: 16, paddingLeft: spacing.lg }}>
            <Ionicons name="link-outline" size={20} color={colors.textSecondary} />
            <Text variant="secondary" numberOfLines={1} style={{ flex: 1 }}>{u}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Retirer le lien ${u}`} onPress={() => patch({ urls: draft.urls.filter((x) => x !== u) })}
              style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="section">Images</Text>
        <UploadPicker kind="image" compact title="Ajoutez des images" onFiles={addImages.add} />
        {addImages.rejection ? <HumanErrorNotice error={addImages.rejection} /> : null}
        {images.rows.length > 0 ? <Text variant="bodyStrong">{summaryLabel(images.summary, { one: "image ajoutée", many: "images ajoutées" })}</Text> : null}
        <FileRows rows={images.rows} onRetry={(r) => { if (r.localId) images.uploads.retry(r.localId); }} onRemove={(r) => void remove(images)(r)} />
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="section">Logo</Text>
        <UploadPicker kind="image" multiple={false} compact title="Ajoutez votre logo" onFiles={addLogo.add} />
        {addLogo.rejection ? <HumanErrorNotice error={addLogo.rejection} /> : null}
        <FileRows rows={logos.rows} onRetry={(r) => { if (r.localId) logos.uploads.retry(r.localId); }} onRemove={(r) => void remove(logos)(r)} />
      </View>
    </FlowScreen>
  );
}

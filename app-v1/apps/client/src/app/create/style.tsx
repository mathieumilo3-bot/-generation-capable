import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Badge, Button, Input, Notice, Skeleton, Text, colors, radii, spacing } from "@app/ui";
import { usableMethods, type EditingMethod } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { FlowScreen } from "@/features/create/FlowScreen";
import { UploadPicker } from "@/features/create/UploadPicker";
import { FileRows } from "@/features/create/FileRows";
import { VoiceNote } from "@/features/create/VoiceNote";
import { useCreateDraft } from "@/features/create/draft";
import { useDraftFiles } from "@/features/create/useDraftFiles";
import { useAddFiles } from "@/features/create/useAddFiles";
import { canContinueFromStyle, summaryLabel, type FileRow } from "@/features/create/logic";
import { useConfig } from "@/providers/ConfigProvider";
import { api } from "@/lib/supabase";
import { href } from "@/lib/href";

const REFS = ["reference"] as const;

export default function StyleRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  if (!projectId) return <Redirect href={href("/create/upload")} />;
  return <RequireAuth><StyleScreen projectId={projectId} /></RequireAuth>;
}

function StyleScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { methods, capabilities, settings, loadingCatalog, refetch } = useConfig();
  const { draft, patch, ready } = useCreateDraft(projectId);
  const usable = usableMethods(methods, "edit_rushes", capabilities);
  const main = usable.filter((m) => !m.advanced);
  const advanced = usable.filter((m) => m.advanced);
  const selected = usable.find((m) => m.id === draft.methodId);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Présélection : la méthode recommandée (« Automatique »). Un choix avancé déjà fait rouvre « Plus d'options ».
  useEffect(() => {
    if (!ready || usable.length === 0) return;
    if (!selected) {
      const pick = main.find((m) => m.recommended) ?? main[0] ?? usable[0];
      if (pick) patch({ methodId: pick.id });
    } else if (selected.advanced) {
      setShowAdvanced(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, usable.length, selected?.id]);

  const refs = useDraftFiles(projectId, REFS);
  const { add, rejection } = useAddFiles({ projectId, mode: "edit_rushes", kind: "reference" });
  const needsRefs = !!selected?.capabilities.requires_references;
  const needsText = !!selected?.capabilities.requires_instructions;
  const voiceOn = capabilities.voice_instructions === true && settings["features.voice_instructions"];
  const canContinue = ready && canContinueFromStyle(selected, { instructions: draft.instructions, referenceCount: refs.rows.filter((r) => r.status !== "failed").length });

  const removeRef = async (row: FileRow) => {
    if (row.source === "local" && row.localId) await refs.uploads.cancel(row.localId);
    else if (row.assetId) await api.assets.remove(row.assetId).catch(() => undefined);
    await refs.refresh();
  };

  return (
    <FlowScreen
      title="Quel résultat voulez-vous ?" step={3} total={4}
      footer={<Button label="Continuer" disabled={!canContinue} onPress={() => router.push(href(`/create/summary?projectId=${projectId}`))} />}
    >
      {loadingCatalog || !ready ? (
        <View style={{ gap: spacing.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={88} radius={radii.xl} />)}</View>
      ) : usable.length === 0 ? (
        <Notice tone="warning" icon="options-outline" title="Les styles ne sont pas disponibles pour le moment."
          body="Vérifiez votre connexion puis réessayez. Aucun montant n'a été prélevé." actionLabel="Réessayer" onAction={refetch} />
      ) : (
        <>
          <View style={{ gap: spacing.md }} accessibilityRole="radiogroup">
            {main.map((m) => <MethodCard key={m.id} method={m} selected={m.id === selected?.id} onPress={() => patch({ methodId: m.id })} />)}
          </View>

          {needsRefs ? (
            <View style={{ gap: spacing.md }}>
              <Text variant="section">Vos vidéos de référence</Text>
              <Text variant="secondary" color="textSecondary">Ajoutez une ou plusieurs vidéos dont vous aimez le montage. Nous nous en inspirons.</Text>
              <UploadPicker title="Ajoutez une référence" compact onFiles={add} />
              {rejection ? <HumanErrorNotice error={rejection} /> : null}
              {refs.rows.length > 0 ? <Text variant="bodyStrong" accessibilityLiveRegion="polite">{summaryLabel(refs.summary, { one: "référence ajoutée", many: "références ajoutées" })}</Text> : null}
              <FileRows rows={refs.rows} onRetry={(r) => { if (r.localId) refs.uploads.retry(r.localId); }} onRemove={(r) => void removeRef(r)} />
            </View>
          ) : null}

          {needsText ? (
            <View style={{ gap: spacing.md }}>
              <Input
                label="Que souhaitez-vous changer ou mettre en avant ?"
                placeholder="Ex. : rythme rapide, sous-titres dynamiques, beaucoup de B-roll et une intro forte."
                value={draft.instructions} onChangeText={(t) => patch({ instructions: t.slice(0, 1500) })}
                multiline maxLength={1500}
              />
              {voiceOn ? <VoiceNote projectId={projectId} /> : null}
            </View>
          ) : null}

          {advanced.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAdvanced }} accessibilityLabel="Plus d'options"
                onPress={() => setShowAdvanced((v) => !v)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text variant="bodyStrong" style={{ color: colors.textSecondary }}>Plus d'options</Text>
                <Ionicons name={showAdvanced ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
              </Pressable>
              {showAdvanced ? (
                <View style={{ gap: spacing.md }} accessibilityRole="radiogroup">
                  {advanced.map((m) => <MethodCard key={m.id} method={m} selected={m.id === selected?.id} onPress={() => patch({ methodId: m.id })} />)}
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </FlowScreen>
  );
}

function MethodCard({ method, selected, onPress }: { method: EditingMethod; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${method.name}${method.recommended ? ", recommandé" : ""}. ${method.description}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 88, borderRadius: radii.xl, padding: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md,
        backgroundColor: colors.surface, borderWidth: 2, borderColor: selected ? colors.accent : "transparent", opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <Text variant="section">{method.name}</Text>
          {method.recommended ? <Badge label="Recommandé" tone="success" /> : null}
        </View>
        <Text variant="secondary" color="textSecondary">{method.description}</Text>
      </View>
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? colors.accent : colors.disabled} />
    </Pressable>
  );
}

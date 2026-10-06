import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Button, Input, Text, colors, radii, spacing } from "@app/ui";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { FlowScreen } from "@/features/create/FlowScreen";
import { useCreateDraft } from "@/features/create/draft";
import { OBJECTIVES } from "@/features/create/logic";
import { href } from "@/lib/href";

export default function ObjectiveRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  if (!projectId) return <Redirect href={href("/create/autonomous/idea")} />;
  return <RequireAuth><ObjectiveScreen projectId={projectId} /></RequireAuth>;
}

function ObjectiveScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { draft, patch, ready } = useCreateDraft(projectId);
  return (
    <FlowScreen title="Quel est votre objectif ?" subtitle="Cela nous aide à choisir le bon ton." step={3} total={5}
      footer={<Button label="Continuer" disabled={!draft.objective || !ready} onPress={() => router.push(href(`/create/autonomous/duration?projectId=${projectId}`))} />}>
      <View style={{ gap: spacing.md }} accessibilityRole="radiogroup">
        {OBJECTIVES.map((o) => {
          const selected = draft.objective === o.key;
          return (
            <Pressable key={o.key} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={o.label} onPress={() => patch({ objective: o.key })}
              style={({ pressed }) => ({ minHeight: 64, borderRadius: radii.xl, paddingHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 2, borderColor: selected ? colors.accent : "transparent", opacity: pressed ? 0.85 : 1 })}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>{o.label}</Text>
              <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? colors.accent : colors.disabled} />
            </Pressable>
          );
        })}
      </View>
      {draft.objective === "other" ? (
        <Input label="Précisez (facultatif)" placeholder="Ex. : recruter une équipe" value={draft.objectiveDetail} onChangeText={(t) => patch({ objectiveDetail: t.slice(0, 200) })} maxLength={200} />
      ) : null}
    </FlowScreen>
  );
}

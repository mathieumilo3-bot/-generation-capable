import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Notice, Screen, Skeleton, Text, colors, radii, spacing } from "@app/ui";
import { availableModes } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { useConfig } from "@/providers/ConfigProvider";
import { analytics } from "@/lib/analytics";
import { api } from "@/lib/supabase";
import { href } from "@/lib/href";

export default function CreateTab() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  return <RequireAuth>{projectId ? <ResumeDraft projectId={projectId} /> : <ChooseMode />}</RequireAuth>;
}

/** Reprise d'un brouillon (?projectId=) : on retombe sur l'étape des fichiers, le brouillon serveur fait foi. */
function ResumeDraft({ projectId }: { projectId: string }) {
  const q = useQuery({ queryKey: ["draft-resume", projectId], queryFn: () => api.projects.get(projectId), retry: 1 });
  if (q.isLoading) {
    return <Screen inTabs><View style={{ gap: spacing.lg, paddingTop: spacing.xxl }}><Skeleton height={34} width="70%" /><Skeleton height={120} radius={radii.xl} /></View></Screen>;
  }
  const p = q.data?.project;
  if (p && p.status === "draft") {
    return <Redirect href={href(p.source_mode === "autonomous" ? `/create/autonomous/idea?projectId=${p.id}` : `/create/upload?projectId=${p.id}`)} />;
  }
  return (
    <Screen inTabs title="Comment voulez-vous créer votre vidéo ?">
      <Notice tone="neutral" icon="information-circle-outline" title="Ce brouillon n'est plus disponible."
        body="Il a peut-être déjà été lancé. Retrouvez-le dans vos projets, ou démarrez une nouvelle vidéo." />
      <Options />
    </Screen>
  );
}

function ChooseMode() {
  return (
    <Screen inTabs title="Comment voulez-vous créer votre vidéo ?">
      <Options />
    </Screen>
  );
}

function Options() {
  const router = useRouter();
  const { capabilities } = useConfig();
  const modes = availableModes(capabilities);
  const start = (mode: "edit_rushes" | "autonomous") => {
    analytics.track("creation_started", { mode });
    router.push(href(mode === "autonomous" ? "/create/autonomous/idea" : "/create/upload"));
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <OptionCard icon="videocam-outline" title="J'ai mes rushs" body="Envoyez vos vidéos, nous faisons le montage." onPress={() => start("edit_rushes")} />
      {modes.includes("autonomous") ? (
        <OptionCard icon="sparkles-outline" title="Créez tout pour moi" body="Donnez votre idée, nous créons la vidéo." onPress={() => start("autonomous")} />
      ) : null}
    </View>
  );
}

function OptionCard({ icon, title, body, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${body}`} onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xxl, minHeight: 160, gap: spacing.md, justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={26} color={colors.accent} />
      </View>
      <View style={{ gap: 4 }}>
        <Text variant="section">{title}</Text>
        <Text variant="body" color="textSecondary">{body}</Text>
      </View>
    </Pressable>
  );
}

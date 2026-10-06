import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { ProjectRow } from "@app/api";
import { Badge, Text, colors, radii, spacing } from "@app/ui";
import { Thumbnail } from "./Thumbnail";
import { formatRelativeDate, projectA11yLabel, projectBadge, projectTitle } from "@/features/projects/logic";

/** Carte de projet (grille « Mes vidéos », accueil). Toute la carte est le bouton (≥ 48 de zone tactile). */
export function ProjectCard({ project, thumbnailUrl, onPress, compact }: {
  project: ProjectRow; thumbnailUrl?: string | null; onPress: () => void; compact?: boolean;
}) {
  const badge = projectBadge(project.status);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={projectA11yLabel(project)} onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View>
        <Thumbnail url={thumbnailUrl} processing={project.status === "processing"} />
        {project.status !== "ready" ? (
          <View style={styles.badge}><Badge label={badge.label} tone={badge.tone} /></View>
        ) : null}
      </View>
      <View style={{ gap: 2 }}>
        <Text variant={compact ? "caption" : "secondary"} style={{ fontWeight: "600" }} numberOfLines={2}>{projectTitle(project)}</Text>
        {compact ? null : <Text variant="caption" color="textSecondary">{formatRelativeDate(project.created_at)}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: spacing.sm, borderRadius: radii.md, minHeight: 48 },
  badge: { position: "absolute", top: spacing.sm, left: spacing.sm, backgroundColor: colors.background, borderRadius: radii.pill },
});

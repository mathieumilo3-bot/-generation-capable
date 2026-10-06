import React from "react";
import { View } from "react-native";
import type { ProjectRow } from "@app/api";
import { ProjectCard } from "@/components/ProjectCard";
import { padGrid } from "@/features/projects/logic";

const COLS = 3;

/** Récentes : 3 colonnes compactes (3 à 6 miniatures). */
export function RecentGrid({ projects, thumbs, expired, onOpen }: {
  projects: ProjectRow[]; thumbs: Record<string, string>; expired?: ReadonlySet<string>; onOpen: (p: ProjectRow) => void;
}) {
  const cells = padGrid(projects, COLS);
  const rows: (ProjectRow | null)[][] = [];
  for (let i = 0; i < cells.length; i += COLS) rows.push(cells.slice(i, i + COLS));
  return (
    <View style={{ gap: 16 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12 }}>
          {row.map((p, j) => p ? (
            <ProjectCard key={p.id} compact project={p} expired={expired?.has(p.id) ?? false} thumbnailUrl={p.thumbnail_path ? thumbs[p.thumbnail_path] : null} onPress={() => onOpen(p)} />
          ) : <View key={`s${j}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

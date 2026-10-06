import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, ProgressBar, Text, colors, spacing } from "@app/ui";
import { formatBytes } from "@app/domain";
import { describeUpload, type FileRow } from "./logic";

/** Liste des fichiers avec progression par fichier ; Reprendre / Réessayer / Retirer. */
export function FileRows({ rows, onRetry, onRemove }: { rows: FileRow[]; onRetry: (row: FileRow) => void; onRemove: (row: FileRow) => void }) {
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }} accessibilityRole="list">
      {rows.map((r) => <FileRowItem key={r.key} row={r} onRetry={() => onRetry(r)} onRemove={() => onRemove(r)} />)}
    </View>
  );
}

function FileRowItem({ row, onRetry, onRemove }: { row: FileRow; onRetry: () => void; onRemove: () => void }) {
  const v = describeUpload(row);
  const icon: keyof typeof Ionicons.glyphMap = v.tone === "success" ? "checkmark-circle" : v.tone === "error" ? "alert-circle" : row.kind === "audio_note" ? "mic-outline" : row.kind === "image" || row.kind === "logo" ? "image-outline" : "videocam-outline";
  const iconColor = v.tone === "success" ? colors.success : v.tone === "error" ? colors.accentPressed : colors.textSecondary;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, gap: spacing.sm }} accessible={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Ionicons name={icon} size={22} color={iconColor} />
        <View style={{ flex: 1 }}>
          <Text variant="body" numberOfLines={1} style={{ fontWeight: "600" }}>{row.name}</Text>
          <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">{formatBytes(row.size)} · {v.label}</Text>
        </View>
      </View>
      {v.progress !== undefined ? <ProgressBar value={v.progress} label={`Envoi de ${row.name}`} /> : null}
      {v.error ? (
        <View style={{ gap: 2 }}>
          <Text variant="secondary" style={{ fontWeight: "600" }}>{v.error.title}</Text>
          <Text variant="secondary" color="textSecondary">{[v.error.detail, v.error.money].filter(Boolean).join(" ")}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {v.canRetry && v.retryLabel ? <Button label={v.retryLabel} size="small" fullWidth={false} onPress={onRetry} /> : null}
        <Button label="Retirer" size="small" variant="ghost" fullWidth={false} onPress={onRemove} accessibilityLabel={`Retirer ${row.name}`} />
      </View>
    </View>
  );
}

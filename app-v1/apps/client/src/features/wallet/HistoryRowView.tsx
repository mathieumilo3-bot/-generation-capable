import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, colors, sizes, spacing } from "@app/ui";
import type { HistoryItem } from "@app/domain";

/** Ligne d'historique : « +25,00 € · Recharge ». Les montants positifs sont en vert, jamais seulement par la couleur (signe + libellé). */
export function HistoryRowView({ item, onPress, showDay }: { item: HistoryItem; onPress: () => void; showDay?: string }) {
  const color = item.tone === "positive" ? "#1E7B3A" : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}${item.subtitle ? `, ${item.subtitle}` : ""}, ${item.amountLabel}${showDay ? `, ${showDay}` : ""}`}
      onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={1}>{item.title}</Text>
        {item.subtitle || showDay ? <Text variant="secondary" color="textSecondary" numberOfLines={1}>{[item.subtitle, showDay].filter(Boolean).join(" · ")}</Text> : null}
      </View>
      <Text variant="bodyStrong" style={{ color, fontVariant: ["tabular-nums"] }}>{item.amountLabel}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.disabled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: sizes.minTouch + 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
});

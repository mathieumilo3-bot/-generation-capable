import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, colors, radii, spacing } from "@app/ui";

/** Bandeau discret de conservation limitée : neutre, puis avertissement quand il reste peu de temps. */
export function ExpiryBanner({ text, warning }: { text: string; warning: boolean }) {
  return (
    <View style={[styles.box, { backgroundColor: warning ? colors.warningTint : colors.surface }]} accessibilityRole={warning ? "alert" : undefined}>
      <Ionicons name={warning ? "time" : "time-outline"} size={20} color={warning ? "#9A5B00" : colors.textSecondary} />
      <Text variant="secondary" color={warning ? "text" : "textSecondary"} style={{ flex: 1, fontWeight: warning ? "600" : "400" }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
});

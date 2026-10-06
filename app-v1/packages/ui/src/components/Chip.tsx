import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../tokens";
import { Text } from "./Text";

/** Filtre / préréglage sélectionnable (Tous · En cours · Terminés, montants de recharge…). */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={label} onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.accent }]}>
      <Text variant="secondary" style={{ color: selected ? colors.onAccent : colors.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 40, paddingHorizontal: spacing.lg, borderRadius: radii.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
});

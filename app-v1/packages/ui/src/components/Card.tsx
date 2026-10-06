import React from "react";
import { Pressable, StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "../tokens";

export interface CardProps extends ViewProps {
  tone?: "surface" | "alt" | "outline" | "accent" | "success" | "warning";
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  selected?: boolean;
}

const toneStyle = (t: NonNullable<CardProps["tone"]>): ViewStyle => ({
  surface: { backgroundColor: colors.surface },
  alt: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  outline: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  accent: { backgroundColor: colors.accentTint },
  success: { backgroundColor: colors.successTint },
  warning: { backgroundColor: colors.warningTint },
}[t]);

/** Pas d'ombre : aplat, rayon généreux. Sélectionnée = liseré rouge (élément actif). */
export function Card({ tone = "surface", padded = true, onPress, selected, style, children, accessibilityLabel, ...rest }: CardProps) {
  const base = [styles.card, toneStyle(tone), padded && { padding: spacing.xl }, selected && styles.selected, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected: !!selected }} onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base} {...rest}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, overflow: "hidden" },
  selected: { borderWidth: 2, borderColor: colors.accent },
});

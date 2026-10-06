import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@app/ui";

/** Logo : aplat rouge (la marque est l'un des rares usages du rouge) et un symbole de lecture. */
export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="play" size={size * 0.46} color={colors.onAccent} style={{ marginLeft: size * 0.04 }} />
    </View>
  );
}

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, colors, haptics, radii, spacing } from "@app/ui";

/** Le geste principal de l'accueil : énorme, rouge, impossible à manquer. */
export function CreateCta({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Créer une vidéo" onPress={() => { haptics.confirm(); onPress(); }}
      style={({ pressed }) => [styles.cta, pressed && { backgroundColor: colors.accentPressed }]}>
      <View style={styles.plus}><Ionicons name="add" size={34} color={colors.accent} /></View>
      <Text variant="title" style={{ color: colors.onAccent, flexShrink: 1 }}>Créer une vidéo</Text>
      <Ionicons name="arrow-forward" size={26} color={colors.onAccent} style={{ marginLeft: "auto" }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cta: { minHeight: 112, borderRadius: radii.xl, backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.lg },
  plus: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.onAccent, alignItems: "center", justifyContent: "center" },
});

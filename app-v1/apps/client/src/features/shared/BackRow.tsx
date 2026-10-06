import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, colors, sizes, spacing } from "@app/ui";
import { href } from "@/lib/href";

/** Retour discret en haut d'un écran de réglages ; `fallback` si l'écran est ouvert directement (lien profond, rechargement web). */
export function BackRow({ fallback = "/(tabs)/account", label = "Retour" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <View style={{ marginTop: spacing.sm, marginLeft: -spacing.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
        onPress={() => { if (router.canGoBack()) router.back(); else router.replace(href(fallback)); }}
        style={({ pressed }) => ({ minHeight: sizes.minTouch, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: spacing.sm, borderRadius: 24, backgroundColor: pressed ? colors.surface : "transparent" })}>
        <Ionicons name="chevron-back" size={24} color={colors.accent} />
        <Text variant="body" style={{ color: colors.accent }}>{label}</Text>
      </Pressable>
    </View>
  );
}

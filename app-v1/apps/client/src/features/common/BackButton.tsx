import React from "react";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@app/ui";
import { href } from "./nav";

/** Retour : revient en arrière, ou va vers `fallback` si l'écran a été ouvert directement (lien, rechargement web). */
export function BackButton({ fallback = "/", label = "Retour", icon = "chevron-back" }: { fallback?: string; label?: string; icon?: "chevron-back" | "close" }) {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      onPress={() => { if (router.canGoBack()) router.back(); else router.replace(href(fallback)); }}
      style={({ pressed }) => ({ width: 48, height: 48, marginLeft: -12, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={icon === "close" ? 26 : 28} color={colors.text} />
    </Pressable>
  );
}

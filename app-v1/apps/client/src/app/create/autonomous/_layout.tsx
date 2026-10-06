import React from "react";
import { View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { Skeleton } from "@app/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { useReduceMotion } from "@/features/shared/useReduceMotion";
import { href } from "@/lib/href";

/**
 * Garde de route : la création autonome n'est atteignable QUE si le moteur l'annonce
 * (`capabilities.autonomous_creation`) ; le serveur refuse de toute façon (`mode_unsupported`).
 */
export default function AutonomousLayout() {
  const { state } = useAuth();
  const { capabilities, loadingCatalog } = useConfig();
  const reduce = useReduceMotion();
  if (state.status === "loading" || loadingCatalog) {
    return <View style={{ flex: 1, padding: 24, justifyContent: "center" }}><Skeleton height={20} width="50%" /></View>;
  }
  if (!capabilities.autonomous_creation) return <Redirect href={href("/(tabs)/create")} />;
  return <Stack screenOptions={{ headerShown: false, animation: reduce ? "none" : "slide_from_right", animationDuration: 200 }} />;
}

import React from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { Skeleton } from "@app/ui";
import { useAuth } from "@/providers/AuthProvider";
import { href } from "@/lib/href";

/** Les écrans qui lisent le solde ou le profil ne s'affichent que pour un utilisateur connecté. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") {
    return <View style={{ flex: 1, padding: 24, justifyContent: "center" }}><Skeleton height={20} width="50%" /></View>;
  }
  if (state.status === "signedOut") return <Redirect href={href("/welcome")} />;
  return <>{children}</>;
}

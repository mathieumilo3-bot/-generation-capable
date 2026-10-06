import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { href } from "@/features/common/nav";

/** Connexion : une fois la session ouverte (code, Apple, Google), on entre directement dans l'app — aucun questionnaire. */
export default function AuthLayout() {
  const { state } = useAuth();
  if (state.status === "signedIn") return <Redirect href={href("/(tabs)")} />;
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", animationDuration: 200 }} />;
}

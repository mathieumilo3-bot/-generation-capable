import React from "react";
import { Stack } from "expo-router";
import { CreateDraftProvider } from "@/features/create/draft";
import { useReduceMotion } from "@/features/shared/useReduceMotion";

/** Flow « Créer » : pile simple, en-tête géré par chaque écran (retour · étape · fermer). */
export default function CreateLayout() {
  const reduce = useReduceMotion();
  return (
    <CreateDraftProvider>
      <Stack screenOptions={{ headerShown: false, animation: reduce ? "none" : "slide_from_right", animationDuration: 200 }} />
    </CreateDraftProvider>
  );
}

import "react-native-gesture-handler";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { AppProviders } from "@/providers/AppProviders";
import { AppGate } from "@/features/shell/AppGate";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <AppGate>
        <Stack screenOptions={{ headerShown: false, animation: "fade", animationDuration: 200 }} />
      </AppGate>
    </AppProviders>
  );
}

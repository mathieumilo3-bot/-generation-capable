import React from "react";
import { Platform, useWindowDimensions } from "react-native";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useAuth } from "@/providers/AuthProvider";
import { usePushRegistration } from "@/lib/push";
import { useLiveSync } from "@/features/common/useLiveSync";
import { AppTabBar } from "@/features/common/AppTabBar";
import { href } from "@/features/common/nav";
import { InviteBanner } from "@/features/account/InviteBanner";
import { useAcceptTerms } from "@/features/account/useAcceptTerms";

export default function TabsLayout() {
  const { state } = useAuth();
  if (state.status === "loading") return null;
  if (state.status !== "signedIn") return <Redirect href={href("/welcome")} />;
  return <SignedInTabs />;
}

function SignedInTabs() {
  useLiveSync();
  usePushRegistration();
  useAcceptTerms();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  return (
    <>
      <InviteBanner />
      <Tabs
        tabBar={(props) => <AppTabBar {...props} desktop={desktop} />}
        screenOptions={{ headerShown: false, tabBarPosition: desktop ? "top" : "bottom", animation: "fade" }}
      >
        <Tabs.Screen name="index" options={{ title: "Accueil" }} />
        <Tabs.Screen name="create" options={{ title: "Créer" }} />
        <Tabs.Screen name="projects" options={{ title: "Projets" }} />
        <Tabs.Screen name="account" options={{ title: "Compte" }} />
      </Tabs>
    </>
  );
}

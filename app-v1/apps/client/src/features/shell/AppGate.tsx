import React, { useEffect } from "react";
import { Linking, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { Button, EmptyState, Screen, Skeleton } from "@app/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { analytics } from "@/lib/analytics";
import { Platform } from "react-native";

/**
 * Garde globale : splash tant que la session n'est pas connue, écran « mise à jour requise »
 * si la version est sous le minimum serveur. La maintenance n'empêche PAS de consulter ses vidéos
 * (le serveur bloque seulement les nouvelles commandes) : elle est affichée comme bandeau par les écrans.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const { versionSupported } = useConfig();

  useEffect(() => {
    if (state.status !== "loading") void SplashScreen.hideAsync();
  }, [state.status]);
  useEffect(() => { analytics.track("app_opened"); }, []);

  if (state.status === "loading") {
    return <View style={{ flex: 1, padding: 24, justifyContent: "center" }}><Skeleton height={20} width="50%" /></View>;
  }
  if (!versionSupported) {
    return (
      <Screen scroll={false}>
        <EmptyState icon="cloud-download-outline" title="Mettez l'application à jour" body="Cette version n'est plus prise en charge. Vos vidéos et votre solde sont en sécurité."
          actionLabel={Platform.OS === "web" ? "Actualiser" : "Mettre à jour"} onAction={() => { if (Platform.OS === "web") location.reload(); else void Linking.openURL(Platform.OS === "ios" ? "itms-apps://apps.apple.com" : "market://details"); }} />
        <Button label="Réessayer" variant="ghost" onPress={() => location?.reload?.()} style={{ display: "none" }} />
      </Screen>
    );
  }
  return <>{children}</>;
}

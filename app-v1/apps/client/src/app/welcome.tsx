import React from "react";
import { View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Button, Screen, Text } from "@app/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { BrandMark } from "@/features/common/BrandMark";
import { ProductPreview } from "@/features/common/ProductPreview";
import { href } from "@/features/common/nav";

/** Premier écran (non connecté) : logo, nom, une phrase, un aperçu, un seul bouton. */
export default function WelcomeScreen() {
  const router = useRouter();
  const { state } = useAuth();
  const { settings } = useConfig();
  if (state.status === "signedIn") return <Redirect href={href("/(tabs)")} />;

  return (
    <Screen
      footer={<Button label="Créer ma première vidéo" onPress={() => router.push(href("/sign-in"))} />}
    >
      <View style={{ gap: 28, paddingTop: 20, alignItems: "stretch" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BrandMark size={44} />
          <Text variant="section" accessibilityRole="header">{settings["product.name"]}</Text>
        </View>
        <View style={{ gap: 8 }}>
          <Text variant="largeTitle">Envoyez vos vidéos, nous faisons le montage.</Text>
          <Text variant="body" color="textSecondary">Vous choisissez, nous créons. Votre vidéo prête à publier, sans logiciel à apprendre.</Text>
        </View>
        <ProductPreview />
      </View>
    </Screen>
  );
}

import React, { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { Button, Notice, Screen, Text, colors } from "@app/ui";
import { useConfig } from "@/providers/ConfigProvider";
import { analytics } from "@/lib/analytics";
import { BackButton } from "@/features/common/BackButton";
import { BrandMark } from "@/features/common/BrandMark";
import { href } from "@/features/common/nav";
import { describeAuthError, authErrorKind } from "@/features/auth/logic";
import { isNativeAppleAvailable, signInWith, type Provider } from "@/features/auth/oauth";

export default function SignInScreen() {
  const router = useRouter();
  const { settings } = useConfig();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [nativeApple, setNativeApple] = useState(false);

  useEffect(() => {
    let alive = true;
    void isNativeAppleAvailable().then((v) => { if (alive) setNativeApple(v); });
    return () => { alive = false; };
  }, []);

  const run = async (provider: Provider) => {
    if (busy) return;
    setError(null);
    setBusy(provider);
    try {
      await signInWith(provider);
      // La navigation vers l'accueil est faite par le layout (session ouverte) ; retour web : page redirigée.
    } catch (e) {
      if (authErrorKind(e) !== "cancelled") setError(describeAuthError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 28, paddingTop: 8 }}>
        <BackButton fallback="/welcome" />
        <View style={{ gap: 14 }}>
          <BrandMark size={48} />
          <Text variant="largeTitle" accessibilityRole="header">Bienvenue</Text>
          <Text variant="body" color="textSecondary">Créez vos vidéos, nous nous occupons du montage.</Text>
        </View>

        {error ? <Notice tone="error" icon="alert-circle-outline" title={error.title} body={error.detail} /> : null}

        <View style={{ gap: 12 }}>
          {nativeApple ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={20}
              style={{ height: 56, width: "100%", opacity: busy ? 0.5 : 1 }}
              onPress={() => void run("apple")}
            />
          ) : (
            <Button label="Continuer avec Apple" variant="secondary" loading={busy === "apple"} disabled={!!busy && busy !== "apple"}
              icon={<Ionicons name="logo-apple" size={22} color={colors.text} />} onPress={() => void run("apple")} />
          )}
          <Button label="Continuer avec Google" variant="secondary" loading={busy === "google"} disabled={!!busy && busy !== "google"}
            icon={<Ionicons name="logo-google" size={20} color={colors.text} />} onPress={() => void run("google")} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text variant="secondary" color="textSecondary">ou</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <Button label="Continuer avec mon e-mail" disabled={!!busy}
            icon={<Ionicons name="mail-outline" size={22} color={colors.onAccent} />}
            onPress={() => { analytics.track("signup_started", { method: "email" }); router.push(href("/email")); }} />
        </View>

        <Text variant="caption" color="textSecondary" align="center">
          {"En continuant, vous acceptez les "}
          <Text variant="caption" accessibilityRole="link" style={{ textDecorationLine: "underline" }} onPress={() => void Linking.openURL(settings["urls.terms"])}>conditions d'utilisation</Text>
          {" et la "}
          <Text variant="caption" accessibilityRole="link" style={{ textDecorationLine: "underline" }} onPress={() => void Linking.openURL(settings["urls.privacy"])}>politique de confidentialité</Text>
          {"."}
        </Text>
      </View>
    </Screen>
  );
}

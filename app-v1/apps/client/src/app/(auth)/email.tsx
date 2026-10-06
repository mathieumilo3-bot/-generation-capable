import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input, Notice, Screen, Text } from "@app/ui";
import { api } from "@/lib/supabase";
import { useConfig } from "@/providers/ConfigProvider";
import { BackButton } from "@/features/common/BackButton";
import { href } from "@/features/common/nav";
import { trackSignInSuccess } from "@/features/auth/oauth";
import { canSubmitPassword, describeAuthError, describePasswordError, isValidEmail, normalizeEmail, showPasswordLogin } from "@/features/auth/logic";

export default function EmailScreen() {
  const router = useRouter();
  const { settings } = useConfig();
  const passwordAllowed = showPasswordLogin(settings);
  const [passwordMode, setPasswordMode] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    setError(null);
    if (!isValidEmail(email)) { setFieldError("Saisissez une adresse e-mail valide, par exemple nom@exemple.fr."); return; }
    setFieldError(null);
    setLoading(true);
    try {
      if (passwordAllowed && passwordMode) {
        if (!canSubmitPassword(email, password)) { setFieldError("Saisissez votre mot de passe."); setLoading(false); return; }
        const session = await api.auth.signInWithPassword(email, password);
        trackSignInSuccess(session?.user, "password");
        // La session ouverte fait basculer le layout vers l'accueil.
        return;
      }
      await api.auth.signInWithEmailOtp(email);
      router.push(href(`/code?email=${encodeURIComponent(normalizeEmail(email))}`));
    } catch (e) {
      setError(passwordAllowed && passwordMode ? describePasswordError(e) : describeAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 24, paddingTop: 8 }}>
        <BackButton fallback="/sign-in" />
        <View style={{ gap: 8 }}>
          <Text variant="largeTitle" accessibilityRole="header">Votre adresse e-mail</Text>
          <Text variant="body" color="textSecondary">{passwordAllowed && passwordMode ? "Saisissez votre e-mail et votre mot de passe." : "Nous vous envoyons un code à 6 chiffres. Pas de mot de passe à retenir."}</Text>
        </View>
        {error ? <Notice tone="error" icon="alert-circle-outline" title={error.title} body={error.detail} /> : null}
        <Input
          label="Adresse e-mail"
          value={email}
          onChangeText={(t) => { setEmail(t); if (fieldError) setFieldError(null); }}
          error={fieldError}
          placeholder="nom@exemple.fr"
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          autoFocus
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        {passwordAllowed && passwordMode ? (
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={(t) => { setPassword(t); if (error) setError(null); }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        ) : null}
        <Button label={passwordAllowed && passwordMode ? "Se connecter" : "Recevoir mon code"} loading={loading} onPress={() => void submit()} />
        {passwordAllowed ? (
          <Button label={passwordMode ? "Recevoir un code par e-mail" : "Se connecter avec un mot de passe"} variant="ghost" size="small" disabled={loading}
            onPress={() => { setPasswordMode((v) => !v); setPassword(""); setError(null); setFieldError(null); }} />
        ) : null}
      </View>
    </Screen>
  );
}

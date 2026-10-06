import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input, Notice, Screen, Text } from "@app/ui";
import { api } from "@/lib/supabase";
import { BackButton } from "@/features/common/BackButton";
import { href } from "@/features/common/nav";
import { describeAuthError, isValidEmail, normalizeEmail } from "@/features/auth/logic";

export default function EmailScreen() {
  const router = useRouter();
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
      await api.auth.signInWithEmailOtp(email);
      router.push(href(`/code?email=${encodeURIComponent(normalizeEmail(email))}`));
    } catch (e) {
      setError(describeAuthError(e));
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
          <Text variant="body" color="textSecondary">Nous vous envoyons un code à 6 chiffres. Pas de mot de passe à retenir.</Text>
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
        <Button label="Recevoir mon code" loading={loading} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}

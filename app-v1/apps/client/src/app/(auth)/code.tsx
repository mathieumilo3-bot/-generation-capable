import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Notice, Screen, Text, haptics } from "@app/ui";
import { api } from "@/lib/supabase";
import { BackButton } from "@/features/common/BackButton";
import { href } from "@/features/common/nav";
import { OtpInput } from "@/features/auth/OtpInput";
import { trackSignInSuccess } from "@/features/auth/oauth";
import { RESEND_DELAY_SEC, describeAuthError, isOtpComplete, resendLabel, resendSecondsLeft } from "@/features/auth/logic";

export default function CodeScreen() {
  const router = useRouter();
  const { email: rawEmail } = useLocalSearchParams<{ email?: string }>();
  const email = typeof rawEmail === "string" ? rawEmail : "";
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(() => Date.now() + RESEND_DELAY_SEC * 1000);
  const [left, setLeft] = useState(RESEND_DELAY_SEC);
  const [resending, setResending] = useState(false);
  const lastTried = useRef<string>("");

  // Pas d'adresse (lien direct) : retour à la saisie de l'e-mail.
  useEffect(() => { if (!email) router.replace(href("/email")); }, [email, router]);

  useEffect(() => {
    const tick = () => setLeft(resendSecondsLeft(deadline, Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  const verify = useCallback(async (value: string) => {
    if (verifying || !email || lastTried.current === value) return;
    lastTried.current = value;
    setVerifying(true);
    setError(null);
    setInfo(null);
    try {
      const session = await api.auth.verifyEmailOtp(email, value);
      trackSignInSuccess(session?.user, "email");
      // La session ouverte fait basculer le layout vers l'accueil.
    } catch (e) {
      haptics.error();
      setError(describeAuthError(e));
      setCode("");
      lastTried.current = "";
    } finally {
      setVerifying(false);
    }
  }, [email, verifying]);

  const onChange = (v: string) => {
    setCode(v);
    if (error) setError(null);
    if (isOtpComplete(v)) void verify(v);
  };

  const resend = async () => {
    if (left > 0 || resending || !email) return;
    setResending(true);
    setError(null);
    try {
      await api.auth.signInWithEmailOtp(email);
      setInfo("Un nouveau code vous a été envoyé.");
      setCode("");
      lastTried.current = "";
      setDeadline(Date.now() + RESEND_DELAY_SEC * 1000);
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 24, paddingTop: 8 }}>
        <BackButton fallback="/email" />
        <View style={{ gap: 8 }}>
          <Text variant="largeTitle" accessibilityRole="header">Saisissez votre code</Text>
          <Text variant="body" color="textSecondary">Nous avons envoyé un code à 6 chiffres à {email}. Il peut arriver dans quelques secondes.</Text>
        </View>
        <OtpInput value={code} onChange={onChange} disabled={verifying} error={!!error} />
        {error ? <Notice tone="error" icon="alert-circle-outline" title={error.title} body={error.detail} /> : null}
        {info && !error ? <Notice tone="success" icon="checkmark-circle-outline" title={info} /> : null}
        <View style={{ gap: 8 }}>
          <Button label="Valider" loading={verifying} disabled={!isOtpComplete(code)} onPress={() => void verify(code)} />
          <Button label={resendLabel(left)} variant="ghost" loading={resending} disabled={left > 0} hapticOnPress={false} onPress={() => void resend()} />
          <Button label="Modifier l'adresse e-mail" variant="ghost" disabled={verifying} onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}

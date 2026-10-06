import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Input, Notice, Screen, Text, colors, haptics, spacing } from "@app/ui";
import { formatEuros, humanizeError, type HumanError } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { BackRow } from "@/features/shared/BackRow";
import { resolveErrorCode } from "@/features/shared/errors";
import { DELETE_PHRASE, classifyDeleteFailure, isDeleteConfirmed, isValidOtp } from "@/features/account/logic";
import { useWallet } from "@/hooks/data";
import { useAuth } from "@/providers/AuthProvider";
import { analytics } from "@/lib/analytics";
import { api, supabase } from "@/lib/supabase";
import { href } from "@/lib/href";

export default function DeleteRoute() {
  return <RequireAuth><DeleteScreen /></RequireAuth>;
}

type Step = "explain" | "confirm" | "code";

const DELETED = ["Vos projets, vos vidéos et leurs versions", "Les fichiers que vous avez envoyés", "Votre profil et vos informations de facturation", "Vos notifications"];

function DeleteScreen() {
  const router = useRouter();
  const { state } = useAuth();
  const wallet = useWallet();
  const email = state.status === "signedIn" ? state.user.email ?? "" : "";
  const [step, setStep] = useState<Step>("explain");
  const [phrase, setPhrase] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<HumanError | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const finish = async () => {
    analytics.track("account_deleted", {});
    haptics.success();
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* la session n'existe déjà plus côté serveur */ }
    router.replace(href("/welcome"));
  };

  /** Tente la suppression ; le serveur exige une authentification de moins de 10 min (`reauth_required`). */
  const attempt = async () => {
    try {
      const res = await api.account.deleteAccount(DELETE_PHRASE);
      if (res.ok) { await finish(); return; }
      await onFailure(res.code);
    } catch (e) {
      await onFailure(await resolveErrorCode(e));
    }
  };

  const sendCode = async () => {
    if (!email) { setError(humanizeError("not_authenticated")); return; }
    try {
      await api.auth.sendReauthCode(email);
      setCodeSent(true);
    } catch (e) {
      setError(humanizeError(await resolveErrorCode(e)));
    }
  };

  const onFailure = async (c: string | undefined) => {
    const kind = classifyDeleteFailure(c);
    haptics.error();
    if (kind === "blocked") { setBlocked(true); setError(null); setStep("confirm"); return; }
    if (kind === "reauth") { setError(null); setCode(""); setStep("code"); if (!codeSent) await sendCode(); return; }
    setError(humanizeError(c));
  };

  const confirmDelete = async () => {
    if (busy || !isDeleteConfirmed(phrase)) return;
    setBusy(true); setError(null); setBlocked(false);
    try { await attempt(); } finally { setBusy(false); }
  };

  const confirmWithCode = async () => {
    if (busy || !isValidOtp(code)) return;
    setBusy(true); setError(null);
    try {
      try {
        await api.auth.verifyEmailOtp(email, code);
      } catch {
        haptics.error();
        setError({ title: "Ce code n'est pas valide ou a expiré.", detail: "Vérifiez-le ou demandez un nouveau code.", money: null, action: "none", actionLabel: null });
        return;
      }
      await attempt();
    } finally {
      setBusy(false);
    }
  };

  const available = wallet.data?.available_cents ?? 0;

  return (
    <Screen
      footer={
        step === "explain" ? <Button label="Continuer" variant="secondary" onPress={() => setStep("confirm")} />
        : step === "confirm" ? <Button label="Supprimer mon compte" variant="danger" loading={busy} disabled={!isDeleteConfirmed(phrase) || blocked} onPress={() => void confirmDelete()} />
        : <Button label="Confirmer et supprimer" variant="danger" loading={busy} disabled={!isValidOtp(code)} onPress={() => void confirmWithCode()} />
      }
    >
      <BackRow fallback="/account/privacy" />
      <Text variant="title" accessibilityRole="header">Supprimer mon compte</Text>

      {step === "explain" ? (
        <>
          <Card tone="surface" style={{ gap: spacing.md }}>
            <Text variant="bodyStrong">Ce qui sera supprimé</Text>
            {DELETED.map((d) => (
              <View key={d} style={{ flexDirection: "row", gap: spacing.md }}>
                <Ionicons name="trash-outline" size={18} color={colors.textSecondary} style={{ marginTop: 2 }} />
                <Text variant="secondary" color="textSecondary" style={{ flex: 1 }}>{d}</Text>
              </View>
            ))}
          </Card>
          <Card tone="surface" style={{ gap: spacing.md }}>
            <Text variant="bodyStrong">Ce qui est conservé</Text>
            <Text variant="secondary" color="textSecondary">Les données de paiement que la loi nous oblige à garder (obligations comptables) sont conservées sous forme anonymisée, sans lien avec votre identité.</Text>
          </Card>
          {available > 0 ? (
            <Notice tone="warning" icon="wallet-outline" title={`Votre solde restant (${formatEuros(available)}) sera supprimé avec votre compte.`} body="Si vous avez une question à ce sujet, contactez le support avant de continuer." actionLabel="Contacter le support" onAction={() => router.push(href("/account/help"))} />
          ) : null}
          <Text variant="bodyStrong">Cette action supprimera définitivement vos projets et données concernés.</Text>
        </>
      ) : null}

      {step === "confirm" ? (
        <>
          <Text variant="body" color="textSecondary">Cette action supprimera définitivement vos projets et données concernés. Elle est irréversible.</Text>
          <Input label={`Pour confirmer, tapez ${DELETE_PHRASE}`} value={phrase} onChangeText={setPhrase} autoCapitalize="characters" autoCorrect={false} autoComplete="off" placeholder={DELETE_PHRASE} />
        </>
      ) : null}

      {step === "code" ? (
        <>
          <Notice tone="neutral" icon="mail-outline" title="Confirmez que c'est bien vous."
            body={codeSent ? `Pour votre sécurité, saisissez le code à 6 chiffres envoyé à ${email}.` : "Pour votre sécurité, nous vous envoyons un code par e-mail."} />
          <Input label="Code reçu par e-mail" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" inputMode="numeric"
            autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} placeholder="000000" />
          <Button label="Recevoir un nouveau code" variant="ghost" onPress={() => void sendCode()} disabled={busy} />
        </>
      ) : null}

      {blocked ? <HumanErrorNotice error={humanizeError("transfer_ownership_first")} /> : null}
      {error ? <HumanErrorNotice error={error} onRetry={step === "code" ? () => void confirmWithCode() : () => void confirmDelete()} /> : null}
    </Screen>
  );
}

import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Notice, Row, Screen, Section, Skeleton, Text, colors, spacing } from "@app/ui";
import { errorCodeOf, formatEuros, humanizeError, type HumanError } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { ConfirmSheet } from "@/features/shared/ConfirmSheet";
import { displayName, initials } from "@/features/account/logic";
import { useProfile, useWallet } from "@/hooks/data";
import { useAuth } from "@/providers/AuthProvider";
import { appVersion } from "@/lib/platform";
import { href } from "@/lib/href";

export default function AccountTab() {
  return <RequireAuth><AccountScreen /></RequireAuth>;
}

function AccountScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const profile = useProfile();
  const wallet = useWallet();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<HumanError | null>(null);
  const p = profile.data;
  const go = (path: string) => () => router.push(href(path));

  const logout = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await signOut();
      setConfirm(false);
      router.replace(href("/welcome"));
    } catch (e) {
      setConfirm(false);
      setError(humanizeError(errorCodeOf(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen inTabs title="Compte">
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }} accessible accessibilityLabel={p ? `${displayName(p)}${p.email ? `, ${p.email}` : ""}` : "Profil en chargement"}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          <Text variant="section" color="textSecondary">{p ? initials(p) : ""}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {p ? (
            <>
              <Text variant="section" numberOfLines={1}>{displayName(p)}</Text>
              {p.email && displayName(p) !== p.email ? <Text variant="secondary" color="textSecondary" numberOfLines={1}>{p.email}</Text> : null}
              {p.company ? <Text variant="secondary" color="textSecondary" numberOfLines={1}>{p.company}</Text> : null}
            </>
          ) : <><Skeleton height={22} width="60%" /><Skeleton height={16} width="40%" /></>}
        </View>
      </View>

      {profile.isError ? <Notice tone="warning" icon="cloud-offline-outline" title="Votre profil n'a pas pu être chargé." body="Vos données sont en sécurité. Réessayez dans un instant." actionLabel="Réessayer" onAction={() => void profile.refetch()} /> : null}
      {error ? <HumanErrorNotice error={error} onRetry={() => setConfirm(true)} /> : null}

      <Section title="Paiements">
        <Row title="Solde et recharges" value={wallet.data ? formatEuros(wallet.data.available_cents) : null} onPress={go("/account/wallet")} />
        <Row title="Historique" onPress={go("/account/history")} />
      </Section>

      <Section title="Mon compte">
        <Row title="Profil" onPress={go("/account/profile")} />
        <Row title="Facturation" onPress={go("/account/billing")} />
        <Row title="Notifications" onPress={go("/notifications")} />
      </Section>

      <Section title="Aide et confidentialité">
        <Row title="Confidentialité" onPress={go("/account/privacy")} />
        <Row title="Aide" onPress={go("/account/help")} />
      </Section>

      <Section footer={`Version ${appVersion}`}>
        <Row title="Se déconnecter" destructive chevron={false} onPress={() => setConfirm(true)} />
      </Section>

      <ConfirmSheet visible={confirm} title="Se déconnecter ?" message="Vos vidéos et votre solde restent en sécurité. Vous les retrouverez en vous reconnectant."
        confirmLabel="Se déconnecter" loading={busy} onConfirm={() => void logout()} onCancel={() => setConfirm(false)} />
    </Screen>
  );
}

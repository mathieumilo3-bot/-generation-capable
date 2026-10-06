import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Notice, Row, Screen, Section, Skeleton, Text, haptics, spacing } from "@app/ui";
import { formatEuros } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { BackRow } from "@/features/shared/BackRow";
import { HistoryRowView } from "@/features/wallet/HistoryRowView";
import { useHistoryEntries } from "@/features/wallet/useHistory";
import { useTopupProvider } from "@/features/wallet/useTopupProvider";
import { recoverPendingPurchases } from "@/features/wallet/provider";
import { perceivedValue } from "@/features/wallet/logic";
import { useWallet } from "@/hooks/data";
import { useUserId } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { analytics } from "@/lib/analytics";
import { api } from "@/lib/supabase";
import { href } from "@/lib/href";

export default function WalletRoute() {
  return <RequireAuth><WalletScreen /></RequireAuth>;
}

function WalletScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useUserId();
  const { settings, pricing, payments } = useConfig();
  const wallet = useWallet();
  const history = useHistoryEntries(5);
  const provider = useTopupProvider();
  const rule = useQuery({ queryKey: ["auto-reload", uid], queryFn: () => api.wallet.autoReload(), enabled: payments.autoReload });
  const [recovered, setRecovered] = useState<number | null>(null);

  useEffect(() => { analytics.track("wallet_viewed", { provider: payments.provider }); }, [payments.provider]);

  // Achats store payés mais non crédités (crash, coupure) : rejoués ici, jamais crédités côté client.
  useEffect(() => {
    let alive = true;
    void recoverPendingPurchases(provider).then((results) => {
      const credited = results.flatMap((r) => (r.status === "completed" ? [r.creditedCents] : []));
      if (!alive || credited.length === 0) return;
      haptics.success();
      setRecovered(credited.reduce((s, c) => s + c, 0));
      void qc.invalidateQueries({ queryKey: ["wallet", uid] });
    });
    return () => { alive = false; };
  }, [provider, qc, uid]);

  const w = wallet.data;
  const value = perceivedValue(settings["wallet.min_topup_cents"], pricing);
  const lastFew = (history.data ?? []).slice(0, 3);

  return (
    <Screen footer={<Button label="Ajouter de l'argent" onPress={() => router.push(href("/account/topup"))} />}>
      <BackRow />
      <Text variant="title" accessibilityRole="header">Paiements</Text>

      <View style={{ gap: spacing.xs }}>
        <Text variant="secondary" color="textSecondary" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>Solde disponible</Text>
        {w ? <Text variant="money" accessibilityLabel={`Solde disponible ${formatEuros(w.available_cents)}`}>{formatEuros(w.available_cents)}</Text> : <Skeleton height={50} width="55%" />}
        {w && w.held_cents > 0 ? <Text variant="secondary" color="textSecondary">{formatEuros(w.held_cents)} réservés pour vos créations en cours.</Text> : null}
        {value ? <Text variant="secondary" color="textSecondary">{value}</Text> : null}
      </View>

      {recovered ? <Notice tone="success" icon="checkmark-circle-outline" title={`${formatEuros(recovered, { compact: true })} ajoutés à votre solde.`} body="Un achat en attente a été finalisé." /> : null}
      {wallet.isError ? <Notice tone="warning" icon="cloud-offline-outline" title="Votre solde n'a pas pu être chargé." body="Votre argent est en sécurité. Réessayez dans un instant." actionLabel="Réessayer" onAction={() => void wallet.refetch()} /> : null}

      <Section title="Recharge" footer={payments.lowBalanceNudge ? "Pour éviter une interruption, nous vous prévenons quand votre solde est faible : vous rechargez alors en un geste." : undefined}>
        {payments.autoReload ? (
          <Row title="Recharge automatique" value={rule.data ? (rule.data.enabled ? "Activée" : "Désactivée") : null} onPress={() => router.push(href("/account/auto-reload"))} />
        ) : (
          <Row title="Alerte de solde faible" subtitle="Notification, puis recharge en un geste" onPress={() => router.push(href("/account/auto-reload"))} />
        )}
      </Section>

      <View style={{ gap: spacing.sm }}>
        <Section title="Historique">
          {history.isLoading ? <View style={{ padding: spacing.lg, gap: spacing.md }}><Skeleton height={20} /><Skeleton height={20} /></View>
            : lastFew.length === 0 ? <View style={{ padding: spacing.lg }}><Text variant="body" color="textSecondary">Aucun mouvement pour le moment.</Text></View>
            : lastFew.map((e) => <HistoryRowView key={e.item.id} item={e.item} onPress={() => router.push(href(`/account/history/${e.item.id}`))} />)}
          {lastFew.length > 0 ? <Row title="Tout voir" onPress={() => router.push(href("/account/history"))} /> : null}
        </Section>
      </View>
    </Screen>
  );
}

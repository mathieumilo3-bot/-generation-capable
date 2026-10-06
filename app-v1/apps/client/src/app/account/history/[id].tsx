import React from "react";
import { Linking, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, Row, Screen, Section, Skeleton, Text, colors, spacing } from "@app/ui";
import { formatEuros } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { BackRow } from "@/features/shared/BackRow";
import { useHistoryEntries } from "@/features/wallet/useHistory";
import { explainLedger } from "@/features/wallet/logic";
import { useUserId } from "@/providers/AuthProvider";
import { api } from "@/lib/supabase";
import { href } from "@/lib/href";

export default function HistoryDetailRoute() {
  return <RequireAuth><HistoryDetail /></RequireAuth>;
}

const fullDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

function HistoryDetail() {
  const { id, limit } = useLocalSearchParams<{ id: string; limit?: string }>();
  const router = useRouter();
  const uid = useUserId();
  const q = useHistoryEntries(Math.max(Number(limit) || 0, 100));
  const entry = q.data?.find((e) => e.item.id === id);
  const paymentId = entry?.raw.payment_id ?? null;
  const payments = useQuery({ queryKey: ["wallet", uid, "payments", 50], queryFn: () => api.wallet.payments(50), enabled: !!paymentId });
  const payment = paymentId ? payments.data?.find((p) => p.id === paymentId) : undefined;

  if (q.isLoading) {
    return <Screen><BackRow fallback="/account/history" /><View style={{ gap: spacing.md }}><Skeleton height={50} width="50%" /><Skeleton height={80} /></View></Screen>;
  }
  if (!entry) {
    return (
      <Screen>
        <BackRow fallback="/account/history" />
        <EmptyState icon="receipt-outline" title="Ce mouvement est introuvable." body="Il a peut-être été archivé. Votre historique complet reste disponible." actionLabel="Retour à l'historique" onAction={() => router.replace(href("/account/history"))} />
      </Screen>
    );
  }
  const { item, raw } = entry;
  const open = (url: string) => { void Linking.openURL(url); };

  return (
    <Screen>
      <BackRow fallback="/account/history" />
      <View style={{ gap: spacing.sm }}>
        <Text variant="secondary" color="textSecondary">{fullDate(item.createdAt)}</Text>
        <Text variant="money" style={{ color: item.tone === "positive" ? "#1E7B3A" : colors.text }} accessibilityLabel={`${item.title}, ${item.amountLabel}`}>{item.amountLabel}</Text>
        <Text variant="section">{item.title}</Text>
        {item.subtitle ? <Text variant="body" color="textSecondary">{item.subtitle}</Text> : null}
      </View>
      <Text variant="body" color="textSecondary">{explainLedger(raw.type)}</Text>

      {payment ? (
        <Section title="Paiement">
          <Row title="Montant payé" value={formatEuros(payment.amount_cents)} />
          {payment.refunded_cents > 0 ? <Row title="Remboursé" value={formatEuros(payment.refunded_cents)} /> : null}
          <Row title="Type" value={payment.kind === "auto_reload" ? "Recharge automatique" : "Recharge"} />
          {payment.receipt_url ? <Row title="Voir le reçu" onPress={() => open(payment.receipt_url as string)} /> : null}
          {payment.invoice_url ? <Row title="Voir la facture" onPress={() => open(payment.invoice_url as string)} /> : null}
        </Section>
      ) : paymentId && payments.isLoading ? <Skeleton height={56} /> : null}

      {raw.project_id ? (
        <Section>
          <Row title="Voir la vidéo concernée" onPress={() => router.push(href(`/project/${raw.project_id}`))} />
        </Section>
      ) : null}

      <Section>
        <Row title="Une question sur ce mouvement ?" subtitle="Écrivez-nous, nous retrouvons l'opération." onPress={() => router.push(href(`/account/help?${raw.project_id ? `project_id=${raw.project_id}&` : ""}${raw.job_id ? `job_id=${raw.job_id}&` : ""}report=1`))} />
      </Section>
    </Screen>
  );
}

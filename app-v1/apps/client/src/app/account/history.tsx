import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, EmptyState, Notice, Screen, Section, Skeleton, Text, spacing } from "@app/ui";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { BackRow } from "@/features/shared/BackRow";
import { HistoryRowView } from "@/features/wallet/HistoryRowView";
import { useHistoryEntries } from "@/features/wallet/useHistory";
import { groupByDay } from "@/features/wallet/logic";
import { href } from "@/lib/href";

const PAGE = 50;

export default function HistoryRoute() {
  return <RequireAuth><HistoryScreen /></RequireAuth>;
}

function HistoryScreen() {
  const router = useRouter();
  const [limit, setLimit] = useState(PAGE);
  const q = useHistoryEntries(limit);
  const sections = useMemo(() => groupByDay((q.data ?? []).map((e) => e.item)), [q.data]);
  const mayHaveMore = (q.data?.length ?? 0) >= limit;

  return (
    <Screen>
      <BackRow fallback="/account/wallet" />
      <Text variant="title" accessibilityRole="header">Historique</Text>
      {q.isLoading ? (
        <View style={{ gap: spacing.md }}><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></View>
      ) : q.isError ? (
        <Notice tone="warning" icon="cloud-offline-outline" title="L'historique n'a pas pu être chargé." body="Votre argent est en sécurité. Réessayez dans un instant." actionLabel="Réessayer" onAction={() => void q.refetch()} />
      ) : sections.length === 0 ? (
        <EmptyState icon="receipt-outline" title="Aucun mouvement pour le moment." body="Vos recharges et vos créations apparaîtront ici." actionLabel="Ajouter de l'argent" onAction={() => router.push(href("/account/topup"))} />
      ) : (
        <>
          {sections.map((s) => (
            <Section key={s.label} title={s.label}>
              {s.items.map((it) => <HistoryRowView key={it.id} item={it} onPress={() => router.push(href(`/account/history/${it.id}?limit=${limit}`))} />)}
            </Section>
          ))}
          {mayHaveMore ? <Button label="Voir plus" variant="secondary" loading={q.isFetching} onPress={() => setLimit((l) => l + PAGE)} /> : null}
        </>
      )}
    </Screen>
  );
}

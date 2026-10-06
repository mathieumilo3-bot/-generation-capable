import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Notice, Screen, Skeleton, Text, haptics, spacing } from "@app/ui";
import { errorCodeOf, humanizeError, type HumanError } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { BackRow } from "@/features/shared/BackRow";
import { useProfile } from "@/hooks/data";
import { useUserId } from "@/providers/AuthProvider";
import { api } from "@/lib/supabase";

export default function ProfileRoute() {
  return <RequireAuth><ProfileScreen /></RequireAuth>;
}

function ProfileScreen() {
  const qc = useQueryClient();
  const uid = useUserId();
  const q = useProfile();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [company, setCompany] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<HumanError | null>(null);

  useEffect(() => {
    if (hydrated || !q.data) return;
    setFirst(q.data.first_name ?? ""); setLast(q.data.last_name ?? ""); setCompany(q.data.company ?? "");
    setHydrated(true);
  }, [q.data, hydrated]);

  const dirty = !!q.data && ((q.data.first_name ?? "") !== first.trim() || (q.data.last_name ?? "") !== last.trim() || (q.data.company ?? "") !== company.trim());

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      await api.account.updateProfile({ first_name: first.trim() || null, last_name: last.trim() || null, company: company.trim() || null });
      await qc.invalidateQueries({ queryKey: ["profile", uid] });
      haptics.success();
      setSaved(true);
    } catch (e) {
      haptics.error();
      setError(humanizeError(errorCodeOf(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Enregistrer" loading={busy} disabled={!dirty} onPress={() => void save()} />}>
      <BackRow />
      <Text variant="title" accessibilityRole="header">Profil</Text>
      {q.isLoading ? (
        <View style={{ gap: spacing.md }}><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></View>
      ) : q.isError ? (
        <Notice tone="warning" icon="cloud-offline-outline" title="Votre profil n'a pas pu être chargé." body="Vos données sont en sécurité. Réessayez dans un instant." actionLabel="Réessayer" onAction={() => void q.refetch()} />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Input label="Prénom" value={first} onChangeText={(t) => { setFirst(t); setSaved(false); }} autoComplete="given-name" textContentType="givenName" autoCapitalize="words" maxLength={80} />
          <Input label="Nom" value={last} onChangeText={(t) => { setLast(t); setSaved(false); }} autoComplete="family-name" textContentType="familyName" autoCapitalize="words" maxLength={80} />
          <Input label="Entreprise (facultatif)" value={company} onChangeText={(t) => { setCompany(t); setSaved(false); }} autoComplete="organization" textContentType="organizationName" maxLength={120} />
          <Input label="E-mail de connexion" value={q.data?.email ?? ""} editable={false} hint="Votre adresse de connexion ne peut pas être modifiée ici." />
        </View>
      )}
      {saved ? <Notice tone="success" icon="checkmark-circle-outline" title="Vos modifications sont enregistrées." /> : null}
      {error ? <HumanErrorNotice error={error} onRetry={() => void save()} /> : null}
    </Screen>
  );
}

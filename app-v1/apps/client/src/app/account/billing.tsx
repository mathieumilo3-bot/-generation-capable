import React, { useEffect, useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Notice, Row, Screen, Section, Skeleton, Text, haptics, spacing } from "@app/ui";
import { errorCodeOf, formatEuros, humanizeError, type HumanError } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { BackRow } from "@/features/shared/BackRow";
import { normalizeBilling, sameBilling, toBillingForm, validateBilling, type BillingForm } from "@/features/account/logic";
import { useProfile } from "@/hooks/data";
import { useUserId } from "@/providers/AuthProvider";
import { api } from "@/lib/supabase";

export default function BillingRoute() {
  return <RequireAuth><BillingScreen /></RequireAuth>;
}

function BillingScreen() {
  const qc = useQueryClient();
  const uid = useUserId();
  const profile = useProfile();
  const payments = useQuery({ queryKey: ["wallet", uid, "payments", 50], queryFn: () => api.wallet.payments(50) });
  const [form, setForm] = useState<BillingForm>(toBillingForm(null));
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<HumanError | null>(null);

  useEffect(() => {
    if (hydrated || !profile.data) return;
    setForm(toBillingForm(profile.data.billing));
    setHydrated(true);
  }, [profile.data, hydrated]);

  const errors = useMemo(() => validateBilling(form), [form]);
  const dirty = !!profile.data && !sameBilling(profile.data.billing ?? {}, normalizeBilling(form));
  const valid = Object.keys(errors).length === 0;
  const set = (k: keyof BillingForm) => (t: string) => { setForm((f) => ({ ...f, [k]: t })); setSaved(false); };

  const save = async () => {
    if (busy || !dirty || !valid) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      await api.account.updateBilling(normalizeBilling(form));
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

  const docs = (payments.data ?? []).filter((p) => p.succeeded_at && (p.receipt_url || p.invoice_url));
  const open = (url: string) => { void Linking.openURL(url); };

  return (
    <Screen footer={<Button label="Enregistrer" loading={busy} disabled={!dirty || !valid} onPress={() => void save()} />}>
      <BackRow />
      <Text variant="title" accessibilityRole="header">Facturation</Text>
      <Text variant="body" color="textSecondary">Ces informations figurent sur vos reçus et factures.</Text>

      {profile.isLoading ? (
        <View style={{ gap: spacing.md }}><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></View>
      ) : profile.isError ? (
        <Notice tone="warning" icon="cloud-offline-outline" title="Vos informations n'ont pas pu être chargées." body="Vos données sont en sécurité. Réessayez dans un instant." actionLabel="Réessayer" onAction={() => void profile.refetch()} />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Input label="Nom" value={form.name} onChangeText={set("name")} autoComplete="name" textContentType="name" autoCapitalize="words" maxLength={120} />
          <Input label="Entreprise (facultatif)" value={form.company} onChangeText={set("company")} autoComplete="organization" textContentType="organizationName" maxLength={120} />
          <Input label="Adresse" value={form.address} onChangeText={set("address")} autoComplete="street-address" textContentType="fullStreetAddress" maxLength={200} />
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}><Input label="Code postal" value={form.postal_code} onChangeText={set("postal_code")} autoComplete="postal-code" textContentType="postalCode" maxLength={12} error={errors.postal_code} /></View>
            <View style={{ flex: 2 }}><Input label="Ville" value={form.city} onChangeText={set("city")} textContentType="addressCity" maxLength={80} /></View>
          </View>
          <Input label="Pays" value={form.country} onChangeText={set("country")} autoComplete="country" textContentType="countryName" maxLength={80} />
          <Input label="N° de TVA (facultatif)" value={form.vat_number} onChangeText={set("vat_number")} autoCapitalize="characters" autoCorrect={false} maxLength={20} error={errors.vat_number} />
          <Input label="E-mail de facturation" value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" maxLength={120} error={errors.email} />
        </View>
      )}

      {saved ? <Notice tone="success" icon="checkmark-circle-outline" title="Vos informations de facturation sont enregistrées." /> : null}
      {error ? <HumanErrorNotice error={error} onRetry={() => void save()} /> : null}

      <Section title="Reçus et factures">
        {payments.isLoading ? <View style={{ padding: spacing.lg }}><Skeleton height={20} /></View>
          : docs.length === 0 ? <View style={{ padding: spacing.lg }}><Text variant="body" color="textSecondary">Aucun reçu disponible pour le moment.</Text></View>
          : docs.flatMap((p) => {
            const day = new Date(p.succeeded_at as string).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
            const rows = [];
            if (p.invoice_url) rows.push(<Row key={`${p.id}-i`} title={`Facture · ${formatEuros(p.amount_cents)}`} subtitle={day} onPress={() => open(p.invoice_url as string)} />);
            if (p.receipt_url) rows.push(<Row key={`${p.id}-r`} title={`Reçu · ${formatEuros(p.amount_cents)}`} subtitle={day} onPress={() => open(p.receipt_url as string)} />);
            return rows;
          })}
      </Section>
    </Screen>
  );
}

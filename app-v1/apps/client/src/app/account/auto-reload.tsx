import React, { useEffect, useRef, useState } from "react";
import { Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Chip, Input, Notice, Row, Screen, Section, Skeleton, Text, colors, haptics, spacing } from "@app/ui";
import { centsToInput, errorCodeOf, formatEuros, humanizeError, parseEurosInput, topupChoices, type HumanError } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { BackRow } from "@/features/shared/BackRow";
import { openHostedPage, paymentReturnUrl } from "@/features/wallet/provider";
import { autoReloadConsent, validateAutoReload } from "@/features/wallet/logic";
import { useUserId } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { analytics } from "@/lib/analytics";
import { platform } from "@/lib/platform";
import { api } from "@/lib/supabase";
import { href } from "@/lib/href";

export default function AutoReloadRoute() {
  return <RequireAuth><AutoReloadScreen /></RequireAuth>;
}

function AutoReloadScreen() {
  const { payments } = useConfig();
  return payments.autoReload ? <AutoReloadForm /> : <LowBalanceExplainer />;
}

/** iOS / Android (achats via le store) : pas de débit silencieux possible → on le dit, sans le simuler. */
function LowBalanceExplainer() {
  const router = useRouter();
  const { settings } = useConfig();
  return (
    <Screen footer={<Button label="Ajouter de l'argent" onPress={() => router.push(href("/account/topup"))} />}>
      <BackRow fallback="/account/wallet" />
      <Text variant="title" accessibilityRole="header">Alerte de solde faible</Text>
      <Card tone="surface" style={{ gap: spacing.md }}>
        <Text variant="bodyStrong">Vous gardez la main sur chaque recharge.</Text>
        <Text variant="body" color="textSecondary">
          Sur cet appareil, les recharges passent par {platform === "ios" ? "l'App Store" : "Google Play"} et demandent toujours votre confirmation : aucune recharge automatique n'est possible.
        </Text>
        <Text variant="body" color="textSecondary">
          Pour éviter une interruption, nous vous envoyons une notification quand votre solde passe sous {formatEuros(settings["wallet.low_balance_threshold_cents"], { compact: true })}. Il suffit de la toucher pour recharger en un geste.
        </Text>
      </Card>
    </Screen>
  );
}

const statusLabel = (p: { succeeded_at: string | null; failure_code: string | null }) => (p.succeeded_at ? "Réussie" : p.failure_code ? "Non aboutie" : "En cours");

function AutoReloadForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useUserId();
  const { settings } = useConfig();
  const ruleQ = useQuery({ queryKey: ["auto-reload", uid], queryFn: () => api.wallet.autoReload() });
  const methodsQ = useQuery({ queryKey: ["payment-methods", uid], queryFn: () => api.wallet.paymentMethods() });
  const runsQ = useQuery({ queryKey: ["wallet", uid, "auto-reload-runs"], queryFn: async () => (await api.wallet.payments(50)).filter((p) => p.kind === "auto_reload") });

  const thresholds = settings["payments.auto_reload_thresholds_cents"];
  const caps = settings["payments.auto_reload_caps_cents"];
  const amounts = topupChoices("web", settings).filter((c) => c <= settings["wallet.max_topup_cents"]);
  const min = settings["wallet.min_topup_cents"];

  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState<number>(thresholds[0] ?? 500);
  const [amount, setAmount] = useState<number>(amounts[0] ?? min);
  const [cap, setCap] = useState<number>(caps[0] ?? 10_000);
  const [customAmount, setCustomAmount] = useState<string | null>(null);
  const [customCap, setCustomCap] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<HumanError | null>(null);
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current || ruleQ.isLoading) return;
    hydrated.current = true;
    const r = ruleQ.data;
    if (!r) return;
    setEnabled(r.enabled); setThreshold(r.threshold_cents); setAmount(r.amount_cents); setCap(r.monthly_cap_cents);
    if (!amounts.includes(r.amount_cents)) setCustomAmount(centsToInput(r.amount_cents));
    if (!caps.includes(r.monthly_cap_cents)) setCustomCap(centsToInput(r.monthly_cap_cents));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleQ.isLoading, ruleQ.data]);

  const methods = methodsQ.data ?? [];
  const method = methods.find((m) => m.is_default) ?? methods[0] ?? null;
  const form = { thresholdCents: threshold, amountCents: amount, monthlyCapCents: cap };
  const invalid = enabled ? validateAutoReload(form, settings) : null;
  const rule = ruleQ.data;

  const persist = async (nextEnabled: boolean) => {
    if (busy) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const res = await api.wallet.setAutoReload({ enabled: nextEnabled, thresholdCents: threshold, amountCents: amount, monthlyCapCents: cap, paymentMethodId: method?.id ?? null });
      if (!res.ok) {
        haptics.error();
        setError(res.code === "payment_method_required"
          ? { title: "Ajoutez une carte pour activer la recharge automatique.", detail: "La carte est enregistrée de façon sécurisée par notre partenaire de paiement.", money: null, action: "none", actionLabel: null }
          : humanizeError(res.code));
        setEnabled(rule?.enabled ?? false);
      } else {
        haptics.success();
        setEnabled(nextEnabled); setSaved(true);
        if (nextEnabled) analytics.track("auto_reload_enabled", { amount_cents: amount, threshold_cents: threshold, cap_cents: cap });
        await qc.invalidateQueries({ queryKey: ["auto-reload", uid] });
        await qc.invalidateQueries({ queryKey: ["wallet", uid, "auto-reload-runs"] });
      }
    } catch (e) {
      haptics.error();
      setError(humanizeError(errorCodeOf(e)));
      setEnabled(rule?.enabled ?? false);
    } finally {
      setBusy(false);
    }
  };

  const addCard = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await api.payments.createCardSetup({ returnUrl: paymentReturnUrl("account/auto-reload") });
      if (res.ok) { await openHostedPage(res.url); return; }
      setError(humanizeError(res.code));
    } catch (e) {
      setError(humanizeError(errorCodeOf(e)));
    }
    setBusy(false);
  };

  const onToggle = (v: boolean) => {
    setSaved(false);
    if (!v) { setEnabled(false); if (rule?.enabled) void persist(false); return; }
    setEnabled(true);
  };

  const customAmountCents = customAmount !== null ? parseEurosInput(customAmount) : null;
  const customCapCents = customCap !== null ? parseEurosInput(customCap) : null;
  const dirty = !rule || rule.enabled !== enabled || rule.threshold_cents !== threshold || rule.amount_cents !== amount || rule.monthly_cap_cents !== cap;

  if (ruleQ.isLoading) {
    return <Screen><BackRow fallback="/account/wallet" /><View style={{ gap: spacing.md }}><Skeleton height={40} width="60%" /><Skeleton height={120} /></View></Screen>;
  }

  return (
    <Screen footer={enabled ? <Button label="Enregistrer" loading={busy} disabled={!!invalid || !method || !dirty} onPress={() => void persist(true)} /> : undefined}>
      <BackRow fallback="/account/wallet" />
      <Text variant="title" accessibilityRole="header">Recharge automatique</Text>
      <Text variant="body" color="textSecondary">Votre solde est rechargé tout seul quand il devient faible, pour ne jamais être interrompu en pleine création.</Text>

      {rule && rule.failure_count > 0 ? (
        <Notice tone="warning" icon="alert-circle-outline" title="La dernière recharge automatique n'a pas abouti."
          body="Votre solde n'a pas été modifié. Vérifiez votre carte ou ajoutez-en une autre." />
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, minHeight: 64 }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Recharge automatique</Text>
          <Text variant="secondary" color="textSecondary">{enabled ? "Activée" : "Désactivée"}</Text>
        </View>
        <Switch value={enabled} onValueChange={onToggle} disabled={busy} accessibilityLabel="Recharge automatique" accessibilityHint="Active ou désactive les recharges automatiques"
          trackColor={{ true: colors.accent, false: colors.border }} />
      </View>

      <Section title="Moyen de paiement">
        {method ? <Row title={`${method.brand ?? "Carte"} •••• ${method.last4 ?? ""}`.trim()} subtitle={method.exp_month && method.exp_year ? `Expire ${String(method.exp_month).padStart(2, "0")}/${String(method.exp_year).slice(-2)}` : undefined} />
          : <Row title="Aucune carte enregistrée" subtitle="Nécessaire pour la recharge automatique" />}
        <Row title={method ? "Changer de carte" : "Ajouter une carte"} onPress={() => void addCard()} />
      </Section>

      {enabled ? (
        <>
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Quand mon solde passe sous</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {thresholds.map((t) => <Chip key={t} label={formatEuros(t, { compact: true })} selected={threshold === t} onPress={() => { setThreshold(t); setSaved(false); }} />)}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Recharger de</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {amounts.map((a) => <Chip key={a} label={formatEuros(a, { compact: true })} selected={customAmount === null && amount === a} onPress={() => { setCustomAmount(null); setAmount(a); setSaved(false); }} />)}
              <Chip label="Autre montant" selected={customAmount !== null} onPress={() => setCustomAmount(customAmount ?? centsToInput(amount))} />
            </View>
            {customAmount !== null ? (
              <Input label="Montant en euros" value={customAmount} keyboardType="decimal-pad" inputMode="decimal"
                onChangeText={(t) => { setCustomAmount(t.slice(0, 9)); const c = parseEurosInput(t); if (c !== null) setAmount(c); setSaved(false); }}
                error={customAmountCents === null && customAmount.trim() ? "Saisissez un montant en euros, par exemple 25." : undefined} />
            ) : null}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Plafond mensuel</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {caps.map((c) => <Chip key={c} label={formatEuros(c, { compact: true })} selected={customCap === null && cap === c} onPress={() => { setCustomCap(null); setCap(c); setSaved(false); }} />)}
              <Chip label="Personnalisé" selected={customCap !== null} onPress={() => setCustomCap(customCap ?? centsToInput(cap))} />
            </View>
            {customCap !== null ? (
              <Input label="Plafond en euros" value={customCap} keyboardType="decimal-pad" inputMode="decimal"
                onChangeText={(t) => { setCustomCap(t.slice(0, 9)); const c = parseEurosInput(t); if (c !== null) setCap(c); setSaved(false); }}
                error={customCapCents === null && customCap.trim() ? "Saisissez un montant en euros, par exemple 250." : undefined} />
            ) : null}
            <Text variant="caption" color="textSecondary">Au-delà de ce total sur un mois, plus aucune recharge automatique n'est lancée.</Text>
          </View>

          {invalid ? <Notice tone="warning" icon="information-circle-outline" title={invalid} /> : <Text variant="secondary" color="textSecondary">{autoReloadConsent(form)}</Text>}
        </>
      ) : null}

      {!method && enabled ? <Notice tone="neutral" icon="card-outline" title="Ajoutez une carte pour activer la recharge automatique." /> : null}
      {saved ? <Notice tone="success" icon="checkmark-circle-outline" title="Vos réglages sont enregistrés." /> : null}
      {error ? <HumanErrorNotice error={error} /> : null}

      <Section title="Recharges automatiques effectuées">
        {runsQ.isLoading ? <View style={{ padding: spacing.lg }}><Skeleton height={20} /></View>
          : (runsQ.data ?? []).length === 0 ? <View style={{ padding: spacing.lg }}><Text variant="body" color="textSecondary">Aucune recharge automatique pour le moment.</Text></View>
          : (runsQ.data ?? []).map((p) => (
            <Row key={p.id} title={`${formatEuros(p.amount_cents)}`} subtitle={new Date(p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} value={statusLabel(p)} chevron={false} />
          ))}
      </Section>
      <View style={{ height: spacing.lg }} />
      <Button label="Voir mon solde" variant="ghost" onPress={() => router.replace(href("/account/wallet"))} />
    </Screen>
  );
}

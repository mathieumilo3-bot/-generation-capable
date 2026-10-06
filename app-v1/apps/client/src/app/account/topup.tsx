import React, { useRef, useState } from "react";
import { Platform, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, Input, Notice, Screen, Skeleton, Text, haptics, spacing } from "@app/ui";
import { errorCodeOf, formatEuros, humanizeError, newIdempotencyKey, topupChoices, type HumanError } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { BackRow } from "@/features/shared/BackRow";
import { AmountGrid } from "@/features/wallet/AmountGrid";
import { useTopupProvider } from "@/features/wallet/useTopupProvider";
import { openHostedPage, paymentReturnUrl } from "@/features/wallet/provider";
import { savePendingTopup } from "@/features/wallet/pending";
import { afterPaymentRoute, initialTopupAmount, mapTopupResult, parseAmountParam, perceivedValue, safeReturnTo, topupAmountState } from "@/features/wallet/logic";
import { useWallet } from "@/hooks/data";
import { useUserId } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { analytics } from "@/lib/analytics";
import { platform } from "@/lib/platform";
import { href } from "@/lib/href";

export default function TopupRoute() {
  return <RequireAuth><TopupScreen /></RequireAuth>;
}

function TopupScreen() {
  const params = useLocalSearchParams<{ amount?: string; returnTo?: string; projectId?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useUserId();
  const { settings, pricing, payments, loadingCatalog } = useConfig();
  const provider = useTopupProvider();
  const wallet = useWallet();

  const returnTo = safeReturnTo(params.returnTo) ?? (params.projectId ? `/create/summary?projectId=${params.projectId}` : null);
  const choices = topupChoices(platform, settings);
  const store = payments.provider !== "stripe";

  const init = initialTopupAmount({ requested: parseAmountParam(params.amount), choices, freeAmount: payments.freeAmount, settings });
  const [selected, setSelected] = useState<number | null>(init.selected);
  const [custom, setCustom] = useState(init.custom);
  const [customText, setCustomText] = useState(init.custom && init.selected ? String(init.selected / 100).replace(".", ",") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<HumanError | null>(null);
  const [info, setInfo] = useState<{ tone: "success" | "neutral"; title: string; body?: string } | null>(null);
  const keyRef = useRef<{ amount: number; key: string } | null>(null);
  const inFlight = useRef(false);

  const customState = custom ? topupAmountState(customText, settings) : null;
  const amount = custom ? (customState?.cents ?? null) : selected;
  const value = amount ? perceivedValue(amount, pricing) : null;

  const select = (c: number) => { setCustom(false); setSelected(c); setError(null); setInfo(null); };

  const pay = async () => {
    if (!provider || !amount || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null); setInfo(null);
    if (keyRef.current?.amount !== amount) keyRef.current = { amount, key: newIdempotencyKey("topup") };
    analytics.track("topup_started", { amount_cents: amount, provider: provider.id });
    try {
      const pack = provider.capabilities.packs.find((p) => p.cents === amount);
      const result = await provider.topup({ amountCents: amount, productId: pack?.productId, idempotencyKey: keyRef.current.key, returnUrl: paymentReturnUrl() });
      const outcome = mapTopupResult(result);
      switch (outcome.kind) {
        case "redirect":
          await savePendingTopup({ returnTo, amountCents: amount, baselineCents: wallet.data?.available_cents ?? null, startedAt: Date.now() });
          await openHostedPage(outcome.url);
          // Web : la page quitte l'app (bouton laissé occupé). Mobile : le navigateur s'ouvre par-dessus, on se libère.
          if (Platform.OS === "web") return;
          break;
        case "completed": {
          keyRef.current = null;
          analytics.track("topup_completed", { amount_cents: outcome.creditedCents, provider: provider.id });
          haptics.success();
          await qc.invalidateQueries({ queryKey: ["wallet", uid] });
          const next = afterPaymentRoute("completed", returnTo);
          if (next) { router.replace(href(next)); return; }
          setInfo({ tone: "success", title: `${formatEuros(outcome.creditedCents, { compact: true })} ajoutés à votre solde.` });
          break;
        }
        case "pending":
          setInfo({ tone: "neutral", title: "Votre paiement est en cours de validation.", body: "Votre solde sera mis à jour dès la confirmation. Vous pouvez quitter cet écran." });
          void qc.invalidateQueries({ queryKey: ["wallet", uid] });
          break;
        case "cancelled":
          break;
        case "failed":
          analytics.track("payment_failed", { code: outcome.code, provider: provider.id, amount_cents: amount });
          haptics.error();
          setError(humanizeError(outcome.code === "unsupported" ? "payment_failed" : outcome.code));
          break;
      }
    } catch (e) {
      haptics.error();
      setError(humanizeError(errorCodeOf(e)));
    }
    inFlight.current = false; setBusy(false);
  };

  const noOption = !loadingCatalog && (!provider || (!payments.freeAmount && choices.length === 0));
  const cta = amount ? `Ajouter ${formatEuros(amount, { compact: true })}` : "Ajouter de l'argent";
  const storeName = platform === "ios" ? "l'App Store" : "Google Play";

  return (
    <Screen
      footer={noOption ? undefined : <Button label={cta} loading={busy} disabled={!amount || !provider} onPress={() => void pay()} />}
    >
      <BackRow fallback="/account/wallet" />
      <View style={{ gap: 6 }}>
        <Text variant="title" accessibilityRole="header">Ajouter de l'argent</Text>
        {wallet.data ? <Text variant="body" color="textSecondary">Solde actuel : {formatEuros(wallet.data.available_cents)}</Text> : null}
      </View>

      {loadingCatalog ? (
        <View style={{ gap: spacing.md }}><Skeleton height={64} /><Skeleton height={64} /></View>
      ) : noOption ? (
        <Notice tone="warning" icon="card-outline" title="Les recharges ne sont pas disponibles pour le moment."
          body="Réessayez dans un instant. Votre solde et vos vidéos ne sont pas affectés." />
      ) : (
        <>
          <AmountGrid choices={choices} selected={custom ? null : selected} onSelect={select}
            extra={payments.freeAmount ? { label: "Autre montant", selected: custom, onPress: () => { setCustom(true); setError(null); setInfo(null); } } : undefined} />

          {custom ? (
            <Input label="Montant en euros" placeholder={`Minimum ${formatEuros(settings["wallet.min_topup_cents"], { compact: true })}`} value={customText}
              onChangeText={(t) => setCustomText(t.slice(0, 9))} keyboardType="decimal-pad" inputMode="decimal" error={customState?.error}
              hint={`De ${formatEuros(settings["wallet.min_topup_cents"], { compact: true })} à ${formatEuros(settings["wallet.max_topup_cents"], { compact: true })}.`} />
          ) : null}

          {value ? (
            <Card tone="surface"><Text variant="bodyStrong" align="center" accessibilityLiveRegion="polite">{value}</Text></Card>
          ) : null}

          <Text variant="caption" color="textSecondary">
            {store
              ? `Le paiement est géré par ${storeName}. Votre solde est mis à jour dès la confirmation.`
              : "Vous serez redirigé vers notre page de paiement sécurisée, puis ramené ici. Votre solde est mis à jour dès la confirmation."}
          </Text>

          {error ? <HumanErrorNotice error={error} onRetry={() => void pay()} /> : null}
          {info ? <Notice tone={info.tone} icon={info.tone === "success" ? "checkmark-circle-outline" : "time-outline"} title={info.title} body={info.body}
            actionLabel={info.tone === "success" ? "Voir mon solde" : undefined} onAction={info.tone === "success" ? () => router.replace(href("/account/wallet")) : undefined} /> : null}
        </>
      )}
    </Screen>
  );
}

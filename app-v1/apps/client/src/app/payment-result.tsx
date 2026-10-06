import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Screen, Text, colors, haptics, spacing } from "@app/ui";
import { formatEuros, humanizeError } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { clearPendingTopup, readPendingTopup } from "@/features/wallet/pending";
import { confirmationState, parsePaymentStatus, safeReturnTo, type PendingTopup } from "@/features/wallet/logic";
import { useWallet } from "@/hooks/data";
import { useUserId } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { analytics } from "@/lib/analytics";
import { api } from "@/lib/supabase";
import { href } from "@/lib/href";

export default function PaymentResultRoute() {
  return <RequireAuth><PaymentResult /></RequireAuth>;
}

function PaymentResult() {
  const params = useLocalSearchParams<{ status?: string; payment_id?: string; returnTo?: string }>();
  const status = parsePaymentStatus(params.status);
  const [pending, setPending] = useState<PendingTopup | null | undefined>(undefined);
  useEffect(() => { void readPendingTopup().then(setPending); }, []);
  if (!status) return <Redirect href={href("/account/wallet")} />;
  if (pending === undefined) return <Screen scroll={false}><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.accent} /></View></Screen>;
  const returnTo = safeReturnTo(params.returnTo) ?? pending?.returnTo ?? null;
  const common = { returnTo, pending, paymentId: params.payment_id ?? null };
  if (status === "success") return <SuccessView {...common} />;
  return <FailureView {...common} cancelled={status === "cancelled"} />;
}

type ViewProps = { returnTo: string | null; pending: PendingTopup | null; paymentId: string | null };

function Frame({ icon, tone, title, body, children }: { icon: keyof typeof Ionicons.glyphMap; tone: "success" | "error" | "neutral"; title: string; body?: string; children?: React.ReactNode }) {
  const bg = tone === "success" ? colors.successTint : tone === "error" ? colors.accentTint : colors.surface;
  const fg = tone === "success" ? colors.success : tone === "error" ? colors.accentPressed : colors.textSecondary;
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: spacing.lg, paddingTop: spacing.huge }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={36} color={fg} />
        </View>
        <Text variant="title" align="center" accessibilityRole="header" accessibilityLiveRegion="polite">{title}</Text>
        {body ? <Text variant="body" color="textSecondary" align="center">{body}</Text> : null}
      </View>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </Screen>
  );
}

/** Retour de paiement réussi : le crédit vient du webhook serveur, on l'attend honnêtement (max ~30 s). */
function SuccessView({ returnTo, pending, paymentId }: ViewProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const uid = useUserId();
  const { payments } = useConfig();
  const wallet = useWallet();
  const current = wallet.data?.available_cents ?? null;
  const startedAt = useRef(Date.now());
  const firstSeen = useRef<number | null>(null);
  if (firstSeen.current === null && current !== null) firstSeen.current = current;
  const baseline = pending?.baselineCents ?? firstSeen.current;
  const [elapsed, setElapsed] = useState(0);

  const paymentsQ = useQuery({
    queryKey: ["wallet", uid, "payments-recent"], queryFn: () => api.wallet.payments(5),
    enabled: !!paymentId, refetchInterval: 2_500,
  });
  const paymentSucceeded = !!paymentId && !!paymentsQ.data?.some((p) => p.id === paymentId && p.succeeded_at !== null);
  const state = confirmationState({ elapsedMs: elapsed, baselineCents: baseline, currentCents: current, paymentSucceeded });

  useEffect(() => {
    if (state !== "waiting") return;
    const t = setInterval(() => {
      setElapsed(Date.now() - startedAt.current);
      void qc.invalidateQueries({ queryKey: ["wallet", uid] });
    }, 2_000);
    return () => clearInterval(t);
  }, [state, qc, uid]);

  const credited = baseline !== null && current !== null && current > baseline ? current - baseline : (pending?.amountCents ?? null);
  const done = useRef(false);
  useEffect(() => {
    if (state !== "confirmed" || done.current) return;
    done.current = true;
    haptics.success();
    analytics.track("topup_completed", { amount_cents: credited, provider: payments.provider });
    void clearPendingTopup();
  }, [state, credited, payments.provider]);
  // Retour automatique au récapitulatif, sans rien refaire.
  useEffect(() => {
    if (state !== "confirmed" || !returnTo) return;
    const t = setTimeout(() => router.replace(href(returnTo)), 1_400);
    return () => clearTimeout(t);
  }, [state, returnTo, router]);

  if (state === "confirmed") {
    return (
      <Frame icon="checkmark-circle" tone="success" title="Paiement confirmé"
        body={credited ? `${formatEuros(credited, { compact: true })} ont été ajoutés à votre solde.` : "Votre solde a été mis à jour."}>
        {returnTo ? <Text variant="secondary" color="textSecondary" align="center">Retour à votre récapitulatif…</Text> : null}
        <Button label={returnTo ? "Continuer" : "Voir mon solde"} onPress={() => router.replace(href(returnTo ?? "/account/wallet"))} />
      </Frame>
    );
  }
  if (state === "timeout") {
    return (
      <Frame icon="time-outline" tone="neutral" title="Confirmation en cours…"
        body="Votre paiement est en cours de traitement. Il apparaîtra dans votre solde dès sa confirmation. Vous n'avez rien d'autre à faire.">
        <Button label="Voir mon solde" onPress={() => router.replace(href("/account/wallet"))} />
        {returnTo ? <Button label="Revenir à mon récapitulatif" variant="secondary" onPress={() => router.replace(href(returnTo))} /> : null}
      </Frame>
    );
  }
  return (
    <Frame icon="hourglass-outline" tone="neutral" title="Confirmation en cours…" body="Nous attendons la confirmation de votre paiement. Cela prend en général quelques secondes.">
      <ActivityIndicator color={colors.accent} />
    </Frame>
  );
}

function FailureView({ cancelled, returnTo, pending }: ViewProps & { cancelled: boolean }) {
  const router = useRouter();
  const { payments } = useConfig();
  const failure = humanizeError("payment_failed");
  useEffect(() => {
    if (cancelled) return;
    haptics.error();
    analytics.track("payment_failed", { code: "payment_failed", provider: payments.provider });
    void clearPendingTopup();
  }, [cancelled, payments.provider]);

  const query = [pending?.amountCents ? `amount=${pending.amountCents}` : null, returnTo ? `returnTo=${encodeURIComponent(returnTo)}` : null].filter(Boolean).join("&");
  const retry = () => router.replace(href(`/account/topup${query ? `?${query}` : ""}`));
  const other = () => router.replace(href(`/account/topup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`));

  if (cancelled) {
    return (
      <Frame icon="close-circle-outline" tone="neutral" title="Paiement annulé" body="Aucun montant n'a été prélevé. Votre solde n'a pas été modifié.">
        <Button label="Réessayer" onPress={retry} />
        <Button label={returnTo ? "Revenir à mon récapitulatif" : "Voir mon solde"} variant="secondary" onPress={() => router.replace(href(returnTo ?? "/account/wallet"))} />
      </Frame>
    );
  }
  return (
    <Frame icon="alert-circle" tone="error" title={failure.title} body={failure.money ?? undefined}>
      <Button label="Réessayer" onPress={retry} />
      {payments.provider === "stripe" ? <Button label="Utiliser un autre moyen de paiement" variant="secondary" onPress={other} /> : null}
    </Frame>
  );
}

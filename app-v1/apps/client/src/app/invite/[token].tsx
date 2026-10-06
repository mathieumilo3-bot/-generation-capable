import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Screen, Skeleton, Text, colors, haptics, spacing } from "@app/ui";
import { errorCodeOf, formatEuros, humanizeError, type HumanError } from "@app/domain";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { clearPendingInvite, savePendingInvite } from "@/features/account/pendingInvite";
import { describeInvitation, isValidInviteToken } from "@/features/account/logic";
import { useAuth } from "@/providers/AuthProvider";
import { api } from "@/lib/supabase";
import { href } from "@/lib/href";

type Applied = { creditedCents: number; replayed: boolean };

export default function InviteRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { state } = useAuth();
  const valid = isValidInviteToken(token);
  const signedIn = state.status === "signedIn";

  // Aperçu possible AVANT connexion (le serveur n'expose que le strict nécessaire).
  const peek = useQuery({ queryKey: ["invite-peek", token], queryFn: async () => await api.account.peekInvitation(token as string), enabled: valid, retry: 1, staleTime: 60_000 });
  const preview = peek.data ? describeInvitation(peek.data) : null;

  const [applied, setApplied] = useState<Applied | null>(null);
  const [error, setError] = useState<HumanError | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const accept = async () => {
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await api.account.acceptInvitation(token);
      if (res.ok) {
        const ok = res as { credited_cents?: number; replayed?: boolean };
        await clearPendingInvite();
        haptics.success();
        setApplied({ creditedCents: ok.credited_cents ?? 0, replayed: ok.replayed === true });
        void qc.invalidateQueries({ queryKey: ["wallet"] });
      } else {
        haptics.error();
        setError(humanizeError(res.code));
      }
    } catch (e) {
      haptics.error();
      setError(humanizeError(errorCodeOf(e)));
    } finally {
      setBusy(false);
    }
  };

  // Connecté : l'invitation s'applique d'elle-même (une seule fois), sans clic supplémentaire.
  useEffect(() => {
    if (!signedIn || !valid || started.current || !preview || preview.kind === "invalid") return;
    started.current = true;
    void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, valid, preview?.kind]);

  const toSignIn = async () => {
    if (valid) await savePendingInvite(token);
    router.push(href("/sign-in"));
  };

  if (!valid || (preview && preview.kind === "invalid") || (peek.isError && !peek.data)) {
    const h = humanizeError("invalid_invitation");
    return (
      <Screen>
        <Frame icon="alert-circle" tone="error" title={h.title} body={h.detail}>
          <Button label={signedIn ? "Aller à l'accueil" : "Continuer"} onPress={() => router.replace(href(signedIn ? "/(tabs)" : "/welcome"))} />
        </Frame>
      </Screen>
    );
  }

  if (applied) {
    const credited = applied.creditedCents > 0;
    return (
      <Screen footer={<Button label={credited ? "Créer ma première vidéo" : "Aller à l'accueil"} onPress={() => router.replace(href(credited ? "/(tabs)/create" : "/(tabs)"))} />}>
        <Frame icon="checkmark-circle" tone="success"
          title={credited ? `${formatEuros(applied.creditedCents, { compact: true })} ajoutés à votre solde` : applied.replayed ? "Invitation déjà activée" : "Invitation activée"}
          body={credited ? "Votre invitation est activée. Vous pouvez créer votre première vidéo dès maintenant." : applied.replayed ? "Cette invitation est déjà activée sur votre compte." : "Votre invitation est activée."} />
      </Screen>
    );
  }

  if (peek.isLoading || !preview) {
    return <Screen><View style={{ gap: spacing.lg, paddingTop: spacing.huge }}><Skeleton height={72} width={72} radius={36} /><Skeleton height={34} width="70%" /><Skeleton height={20} /></View></Screen>;
  }

  const hello = preview.firstName ? `Bonjour ${preview.firstName}, ` : "";
  const headline = preview.kind === "credit" ? `${formatEuros(preview.creditCents, { compact: true })} vous attendent`
    : preview.kind === "team" ? "Vous êtes invité(e) à rejoindre une équipe" : "Vous avez reçu une invitation";
  const body = preview.kind === "credit" ? `${hello}${hello ? "v" : "V"}otre invitation ajoute ${formatEuros(preview.creditCents, { compact: true })} à votre solde pour créer vos vidéos.`
    : preview.kind === "team" ? `${hello}${preview.company ? `${preview.company} vous invite` : "une équipe vous invite"} à la rejoindre.` : `${hello}activez-la pour commencer.`;

  return (
    <Screen footer={signedIn ? undefined : <Button label="Continuer" onPress={() => void toSignIn()} />}>
      <Frame icon="gift-outline" tone="neutral" title={headline} body={body}>
        {!signedIn ? <Text variant="secondary" color="textSecondary" align="center">Connectez-vous ou créez votre compte : l'invitation s'appliquera automatiquement.</Text> : null}
        {signedIn && busy ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <HumanErrorNotice error={error} onRetry={() => void accept()} /> : null}
      </Frame>
    </Screen>
  );
}

function Frame({ icon, tone, title, body, children }: { icon: keyof typeof Ionicons.glyphMap; tone: "success" | "error" | "neutral"; title: string; body?: string; children?: React.ReactNode }) {
  const bg = tone === "success" ? colors.successTint : tone === "error" ? colors.accentTint : colors.surface;
  const fg = tone === "success" ? colors.success : tone === "error" ? colors.accentPressed : colors.accent;
  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ alignItems: "center", gap: spacing.lg, paddingTop: spacing.huge }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={36} color={fg} />
        </View>
        <Text variant="title" align="center" accessibilityRole="header" accessibilityLiveRegion="polite">{title}</Text>
        {body ? <Text variant="body" color="textSecondary" align="center">{body}</Text> : null}
      </View>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

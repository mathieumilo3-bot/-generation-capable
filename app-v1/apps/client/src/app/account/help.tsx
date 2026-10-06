import React, { useMemo, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Button, Chip, Input, Notice, Row, Screen, Section, Text, colors, haptics, spacing } from "@app/ui";
import { currentRules, errorCodeOf, humanizeError, type HumanError } from "@app/domain";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { HumanErrorNotice } from "@/features/shared/HumanErrorNotice";
import { BackRow } from "@/features/shared/BackRow";
import { buildFaq } from "@/features/account/faq";
import { SUPPORT_CATEGORIES, canSendSupport, supportContext, type SupportCategory } from "@/features/account/logic";
import { useConfig } from "@/providers/ConfigProvider";
import { api } from "@/lib/supabase";

export default function HelpRoute() {
  return <RequireAuth><HelpScreen /></RequireAuth>;
}

function HelpScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const { settings, pricing } = useConfig();
  const context = supportContext(params);
  const hasContext = !!(context.projectId || context.jobId || context.versionId);
  const [open, setOpen] = useState<string | null>(null);
  const [reporting, setReporting] = useState(hasContext || params.report === "1");
  const [category, setCategory] = useState<SupportCategory>(context.projectId || context.jobId ? "video_problem" : "other");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<HumanError | null>(null);

  const faq = useMemo(() => {
    const rules = currentRules(pricing, "edit_rushes");
    const prices = rules.map((r) => r.price_cents);
    return buildFaq({
      minPriceCents: prices.length ? Math.min(...prices) : null, maxPriceCents: prices.length ? Math.max(...prices) : null,
      supportEmail: settings["product.support_email"],
    });
  }, [pricing, settings]);

  const send = async () => {
    if (busy || !canSendSupport(message)) return;
    setBusy(true); setError(null);
    try {
      await api.account.supportRequest({ category, message: message.trim(), ...context });
      haptics.success();
      setSent(true); setMessage("");
    } catch (e) {
      haptics.error();
      setError(humanizeError(errorCodeOf(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackRow />
      <Text variant="title" accessibilityRole="header">Aide</Text>

      <Section title="Questions fréquentes">
        {faq.map((f) => {
          const expanded = open === f.id;
          return (
            <View key={f.id}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={f.question} onPress={() => setOpen(expanded ? null : f.id)}
                style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: pressed ? colors.border : "transparent" })}>
                <Text variant="body" style={{ flex: 1, fontWeight: "600" }}>{f.question}</Text>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
              </Pressable>
              {expanded ? <Text variant="secondary" color="textSecondary" style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>{f.answer}</Text> : null}
            </View>
          );
        })}
      </Section>

      <Section title="Besoin d'un coup de main ?">
        <Row title="Signaler un problème" subtitle="Nous vous répondons par e-mail" onPress={() => { setReporting((v) => !v); setSent(false); }} chevron={!reporting} />
        {reporting ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Text variant="secondary" color="textSecondary">Votre message concerne…</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {SUPPORT_CATEGORIES.map((c) => <Chip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />)}
            </View>
            <Input label="Que s'est-il passé ?" placeholder="Décrivez le problème en quelques phrases." value={message} onChangeText={(t) => { setMessage(t.slice(0, 2000)); setSent(false); }} multiline maxLength={2000}
              hint={hasContext ? "La vidéo concernée, la version de l'application et votre appareil sont joints automatiquement." : "La version de l'application et votre appareil sont joints automatiquement."} />
            <Button label="Envoyer" loading={busy} disabled={!canSendSupport(message)} onPress={() => void send()} />
            {sent ? <Notice tone="success" icon="checkmark-circle-outline" title="Merci, nous avons bien reçu votre message." body="Nous vous répondons par e-mail dès que possible." /> : null}
            {error ? <HumanErrorNotice error={error} onRetry={() => void send()} /> : null}
          </View>
        ) : null}
        <Row title="Contacter le support" subtitle={settings["product.support_email"]} onPress={() => { void Linking.openURL(`mailto:${settings["product.support_email"]}`); }} />
      </Section>
    </Screen>
  );
}

import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Notice, Skeleton, Text, colors, radii, spacing } from "@app/ui";
import { currentRules, formatEuros, type CreationMode, type PricingRule } from "@app/domain";
import { useConfig } from "@/providers/ConfigProvider";
import { FlowScreen } from "./FlowScreen";
import { useCreateDraft } from "./draft";

/** Règles de prix affichables : en vigueur pour le mode, dans les limites du moteur. Jamais de prix par défaut. */
export function useDurationRules(mode: CreationMode): PricingRule[] {
  const { pricing, capabilities } = useConfig();
  const max = capabilities.max_duration_sec;
  return currentRules(pricing, mode).filter((r) => max === undefined || r.duration_max_sec <= max);
}

/** « Quelle durée voulez-vous ? » — cartes avec prix visible immédiatement (règles du serveur). */
export function DurationStep({ projectId, mode, step, total, onContinue }: {
  projectId: string | null; mode: CreationMode; step: number; total: number; onContinue: () => void;
}) {
  const { loadingCatalog, refetch } = useConfig();
  const rules = useDurationRules(mode);
  const { draft, patch, ready } = useCreateDraft(projectId);
  const selected = rules.find((r) => r.id === draft.pricingRuleId);

  return (
    <FlowScreen
      title="Quelle durée voulez-vous ?" subtitle="Le prix est affiché avant toute validation." step={step} total={total}
      footer={<Button label="Continuer" disabled={!selected || !ready} onPress={onContinue} />}
    >
      {loadingCatalog || !ready ? (
        <View style={{ gap: spacing.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={76} radius={radii.xl} />)}</View>
      ) : rules.length === 0 ? (
        <Notice tone="warning" icon="pricetag-outline" title="Les tarifs ne sont pas disponibles pour le moment."
          body="Vérifiez votre connexion puis réessayez. Aucun montant n'a été prélevé." actionLabel="Réessayer" onAction={refetch} />
      ) : (
        <View style={{ gap: spacing.md }} accessibilityRole="radiogroup">
          {rules.map((r) => <RuleCard key={r.id} rule={r} selected={r.id === selected?.id} onPress={() => patch({ pricingRuleId: r.id })} />)}
        </View>
      )}
    </FlowScreen>
  );
}

function RuleCard({ rule, selected, onPress }: { rule: PricingRule; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${rule.label}, ${formatEuros(rule.price_cents)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 76, borderRadius: radii.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md,
        backgroundColor: colors.surface, borderWidth: 2, borderColor: selected ? colors.accent : "transparent", opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text variant="section">{rule.label}</Text>
      </View>
      <Text variant="section">{formatEuros(rule.price_cents)}</Text>
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? colors.accent : colors.disabled} />
    </Pressable>
  );
}

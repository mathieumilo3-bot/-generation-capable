import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, colors, haptics, radii, spacing } from "@app/ui";
import { LegalLink } from "./LegalLink";

/** Case à cocher de consentement : jamais cochée d'office, zone tactile ≥ 48, rôle « checkbox » pour les lecteurs d'écran. */
export function ConsentCheckbox({ checked, onChange, label, moreUrl, moreLabel = "En savoir plus" }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; moreUrl?: string; moreLabel?: string;
}) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.xs }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label}
        onPress={() => { haptics.tap(); onChange(!checked); }}
        style={{ minHeight: 48, flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        <Ionicons name={checked ? "checkbox" : "square-outline"} size={28} color={checked ? colors.accent : colors.textSecondary} style={{ marginTop: -2 }} />
        <Text variant="secondary" style={{ flex: 1 }}>{label}</Text>
      </Pressable>
      {moreUrl ? (
        <Text variant="secondary" style={{ paddingLeft: 28 + spacing.md, paddingVertical: spacing.sm }}><LegalLink url={moreUrl} label={moreLabel} /></Text>
      ) : null}
    </View>
  );
}

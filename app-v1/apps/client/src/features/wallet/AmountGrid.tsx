import React from "react";
import { Pressable, View } from "react-native";
import { Text, colors, radii, spacing } from "@app/ui";
import { formatEuros } from "@app/domain";

/** Grille de montants sélectionnables (préréglages web, packs des stores). `extra` ajoute une carte (ex. « Autre montant »). */
export function AmountGrid({ choices, selected, onSelect, extra }: {
  choices: readonly number[]; selected: number | null; onSelect: (cents: number) => void;
  extra?: { label: string; selected: boolean; onPress: () => void };
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }} accessibilityRole="radiogroup">
      {choices.map((c) => (
        <AmountCard key={c} label={formatEuros(c, { compact: true })} selected={selected === c} onPress={() => onSelect(c)} />
      ))}
      {extra ? <AmountCard label={extra.label} selected={extra.selected} onPress={extra.onPress} /> : null}
    </View>
  );
}

function AmountCard({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1, flexBasis: "30%", minWidth: 96, minHeight: 64, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md,
        backgroundColor: colors.surface, borderWidth: 2, borderColor: selected ? colors.accent : "transparent", opacity: pressed ? 0.85 : 1,
      })}>
      <Text variant="bodyStrong" align="center">{label}</Text>
    </Pressable>
  );
}

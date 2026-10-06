import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen, Text, colors, sizes, spacing } from "@app/ui";
import { href } from "@/lib/href";

/**
 * Cadre commun des étapes : en-tête minimal (retour · étape · fermer), grand titre, pied fixe pour le CTA.
 * L'en-tête vit dans le contenu (et non dans l'en-tête de pile) pour respecter la zone sûre gérée par <Screen>.
 */
export function FlowScreen({ title, subtitle, step, total, footer, children, scroll = true }: {
  title: string; subtitle?: string; step?: number; total?: number; footer?: React.ReactNode; children?: React.ReactNode; scroll?: boolean;
}) {
  const router = useRouter();
  const back = () => { if (router.canGoBack()) router.back(); else router.replace(href("/(tabs)/create")); };
  const close = () => router.replace(href("/(tabs)"));
  return (
    <Screen footer={footer} scroll={scroll}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm }}>
        <IconButton icon="chevron-back" label="Retour" onPress={back} />
        {step && total ? <Text variant="caption" color="textSecondary" accessibilityLabel={`Étape ${step} sur ${total}`}>Étape {step} sur {total}</Text> : <View />}
        <IconButton icon="close" label="Fermer" onPress={close} />
      </View>
      <View style={{ gap: 6 }}>
        <Text variant="title" accessibilityRole="header">{title}</Text>
        {subtitle ? <Text variant="body" color="textSecondary">{subtitle}</Text> : null}
      </View>
      {children}
    </Screen>
  );
}

function IconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }) => ({ width: sizes.minTouch, height: sizes.minTouch, alignItems: "center", justifyContent: "center", borderRadius: sizes.minTouch / 2, backgroundColor: pressed ? colors.surface : "transparent" })}>
      <Ionicons name={icon} size={26} color={colors.text} />
    </Pressable>
  );
}

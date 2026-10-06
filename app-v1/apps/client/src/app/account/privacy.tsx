import React from "react";
import { Linking, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Row, Screen, Section, Text, colors, spacing } from "@app/ui";
import { RequireAuth } from "@/features/shared/RequireAuth";
import { BackRow } from "@/features/shared/BackRow";
import { useConfig } from "@/providers/ConfigProvider";
import { href } from "@/lib/href";

export default function PrivacyRoute() {
  return <RequireAuth><PrivacyScreen /></RequireAuth>;
}

/** Garanties réelles uniquement : accès privé par compte (RLS), URLs signées temporaires, HTTPS, séparation des clients. */
const GUARANTEES = [
  "Vos vidéos et vos fichiers sont stockés dans un espace privé : seul votre compte y accède.",
  "Les liens de lecture et de téléchargement sont signés et temporaires.",
  "Toutes les communications avec nos serveurs sont protégées par HTTPS.",
  "Les données de chaque client sont séparées de celles des autres clients.",
];

function PrivacyScreen() {
  const router = useRouter();
  const { settings } = useConfig();
  const open = (url: string) => () => { void Linking.openURL(url); };
  return (
    <Screen>
      <BackRow />
      <Text variant="title" accessibilityRole="header">Confidentialité</Text>

      <Card tone="surface" style={{ gap: spacing.md }}>
        <Text variant="bodyStrong">Comment vos données sont protégées</Text>
        {GUARANTEES.map((g) => (
          <View key={g} style={{ flexDirection: "row", gap: spacing.md }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} style={{ marginTop: 2 }} />
            <Text variant="secondary" color="textSecondary" style={{ flex: 1 }}>{g}</Text>
          </View>
        ))}
      </Card>

      <Section title="Documents">
        <Row title="Politique de confidentialité" onPress={open(settings["urls.privacy"])} />
        <Row title="Conditions d'utilisation" onPress={open(settings["urls.terms"])} />
        <Row title="Gestion de mes données" onPress={open(settings["urls.manage_data"])} />
      </Section>

      <Section footer="Cette action est définitive. Nous vous expliquons ce qui est supprimé avant toute confirmation.">
        <Row title="Supprimer mon compte" destructive onPress={() => router.push(href("/account/delete"))} />
      </Section>
    </Screen>
  );
}

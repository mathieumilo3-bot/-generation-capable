import React from "react";
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, sizes, spacing } from "../tokens";
import { Text } from "./Text";

export interface ScreenProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  /** Pied fixe (CTA principal) au-dessus de la barre d'accueil. */
  footer?: React.ReactNode;
  headerRight?: React.ReactNode;
  contentStyle?: ViewStyle;
  /** Vrai si un onglet est affiché sous l'écran (n'ajoute pas l'inset bas). */
  inTabs?: boolean;
  keyboardDismiss?: boolean;
}

/** Contenu centré (max 560 px sur le web), respiration verticale généreuse, zones sûres respectées. */
export function Screen({ children, title, subtitle, scroll = true, footer, headerRight, contentStyle, inTabs, keyboardDismiss = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = (
    <View style={[styles.column, contentStyle]}>
      {title ? (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text variant="largeTitle" accessibilityRole="header">{title}</Text>
            {subtitle ? <Text variant="body" color="textSecondary" style={{ marginTop: 6 }}>{subtitle}</Text> : null}
          </View>
          {headerRight}
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <View style={[styles.root, { paddingTop: Platform.OS === "web" ? spacing.lg : insets.top }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: spacing.huge + (footer ? 0 : inTabs ? 0 : insets.bottom) }]}
          keyboardShouldPersistTaps="handled" keyboardDismissMode={keyboardDismiss ? "on-drag" : "none"} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : <View style={styles.scroll}>{body}</View>}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.column}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  column: { width: "100%", maxWidth: sizes.contentMaxWidth, alignSelf: "center", paddingHorizontal: spacing.xl, gap: spacing.xl },
  header: { flexDirection: "row", alignItems: "flex-start", paddingTop: spacing.lg, gap: spacing.md },
  footer: { backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
});

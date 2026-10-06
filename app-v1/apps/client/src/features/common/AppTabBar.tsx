import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Text, colors, haptics, radii, sizes, spacing } from "@app/ui";
import { useConfig } from "@/providers/ConfigProvider";
import { BrandMark } from "./BrandMark";

interface TabDef { label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }

const TABS: Record<string, TabDef> = {
  index: { label: "Accueil", icon: "home-outline", iconActive: "home" },
  create: { label: "Créer", icon: "add", iconActive: "add" },
  projects: { label: "Projets", icon: "film-outline", iconActive: "film" },
  account: { label: "Compte", icon: "person-outline", iconActive: "person" },
};
const ORDER = ["index", "create", "projects", "account"];

/**
 * Barre d'onglets : 4 espaces, « Créer » en rouge, l'action la plus évidente.
 * Mobile : barre inférieure. Web large : navigation sobre en haut, contenu centré.
 */
export function AppTabBar({ state, navigation, insets, desktop }: BottomTabBarProps & { desktop: boolean }) {
  const { settings } = useConfig();
  const routes = ORDER.flatMap((name) => {
    const index = state.routes.findIndex((r) => r.name === name);
    const route = state.routes[index];
    return route ? [{ route, index }] : [];
  });

  const press = (name: string, key: string, focused: boolean, params: object | undefined) => {
    const event = navigation.emit({ type: "tabPress", target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      haptics.tap();
      navigation.navigate(name, params);
    }
  };

  if (desktop) {
    return (
      <View style={styles.topBar} accessibilityRole="tablist">
        <View style={styles.topInner}>
          <View style={styles.brand}>
            <BrandMark size={32} />
            <Text variant="bodyStrong">{settings["product.name"]}</Text>
          </View>
          <View style={styles.topLinks}>
            {routes.map(({ route, index }) => {
              const def = TABS[route.name]!;
              const focused = state.index === index;
              const isCreate = route.name === "create";
              return (
                <Pressable key={route.key} role="tab" accessibilityLabel={def.label} accessibilityState={{ selected: focused }}
                  onPress={() => press(route.name, route.key, focused, route.params)}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.topLink,
                    isCreate && styles.topCreate,
                    !isCreate && (hovered || pressed) && { backgroundColor: colors.surface },
                    isCreate && pressed && { backgroundColor: colors.accentPressed },
                  ]}>
                  <Text variant="secondary" style={{ fontWeight: "600", color: isCreate ? colors.onAccent : focused ? colors.text : colors.textSecondary }}>{def.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]} accessibilityRole="tablist">
      {routes.map(({ route, index }) => {
        const def = TABS[route.name]!;
        const focused = state.index === index;
        const isCreate = route.name === "create";
        return (
          <Pressable key={route.key} role="tab" accessibilityLabel={def.label} accessibilityState={{ selected: focused }}
            onPress={() => press(route.name, route.key, focused, route.params)} style={styles.item}>
            {isCreate ? (
              <View style={[styles.createPill, focused && { backgroundColor: colors.accentPressed }]}>
                <Ionicons name={def.icon} size={30} color={colors.onAccent} />
              </View>
            ) : (
              <Ionicons name={focused ? def.iconActive : def.icon} size={25} color={focused ? colors.text : colors.textSecondary} />
            )}
            <Text variant="caption" maxFontSizeMultiplier={1.2}
              style={{ fontSize: 11, lineHeight: 14, fontWeight: "600", color: focused || isCreate ? colors.text : colors.textSecondary }}>{def.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: { flexDirection: "row", alignItems: "flex-end", backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  item: { flex: 1, minHeight: sizes.minTouch + 8, alignItems: "center", justifyContent: "flex-end", gap: 2 },
  createPill: { width: 64, height: 40, borderRadius: radii.lg, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  topBar: { backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  topInner: { width: "100%", maxWidth: sizes.contentMaxWidth, alignSelf: "center", paddingHorizontal: spacing.xl, minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  topLinks: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  topLink: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  topCreate: { backgroundColor: colors.accent, marginHorizontal: spacing.xs },
});

import React from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, sizes, spacing } from "@app/ui";

/** Page d'onglet : contenu centré (web), zones sûres, tirer pour rafraîchir. */
export function Page({ children, onRefresh, refreshing = false, maxWidth = sizes.contentMaxWidth }: {
  children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean; maxWidth?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: Platform.OS === "web" ? spacing.lg : insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.huge }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined}
      >
        <View style={[styles.column, { maxWidth }]}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  column: { width: "100%", alignSelf: "center", paddingHorizontal: spacing.xl, gap: spacing.xl },
});

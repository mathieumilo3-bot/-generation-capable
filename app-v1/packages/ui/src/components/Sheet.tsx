import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, sizes, spacing } from "../tokens";
import { Text } from "./Text";

/** Feuille modale du bas (menus, confirmations). Fermeture par fond, bouton retour Android et Échap (web). */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]} accessibilityViewIsModal>
        <View style={styles.grabber} />
        {title ? <Text variant="section" style={{ marginBottom: spacing.md }} accessibilityRole="header">{title}</Text> : null}
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radii.xl + 6, borderTopRightRadius: radii.xl + 6, padding: spacing.xl, width: "100%", maxWidth: sizes.contentMaxWidth, alignSelf: "center", gap: spacing.sm },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md },
});

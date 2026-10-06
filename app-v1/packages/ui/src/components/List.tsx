import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, sizes, spacing } from "../tokens";
import { Text } from "./Text";

/** Section de réglages : titre discret + groupe arrondi de lignes. */
export function Section({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? <Text variant="secondary" color="textSecondary" style={{ paddingHorizontal: spacing.xs, textTransform: "uppercase", letterSpacing: 0.4 }} accessibilityRole="header">{title}</Text> : null}
      <View style={styles.group}>{React.Children.toArray(children).map((c, i, arr) => (
        <React.Fragment key={i}>{c}{i < arr.length - 1 ? <View style={styles.sep} /> : null}</React.Fragment>))}
      </View>
      {footer ? <Text variant="caption" color="textSecondary" style={{ paddingHorizontal: spacing.xs }}>{footer}</Text> : null}
    </View>
  );
}

export function Row({ title, subtitle, value, onPress, chevron = !!onPress, destructive, leading, right }: {
  title: string; subtitle?: string | null; value?: string | null; onPress?: () => void; chevron?: boolean; destructive?: boolean;
  leading?: React.ReactNode; right?: React.ReactNode;
}) {
  const content = (
    <View style={styles.row}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" style={destructive ? { color: colors.accentPressed } : undefined}>{title}</Text>
        {subtitle ? <Text variant="secondary" color="textSecondary">{subtitle}</Text> : null}
      </View>
      {value ? <Text variant="body" color="textSecondary">{value}</Text> : null}
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.disabled} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[title, subtitle, value].filter(Boolean).join(", ")} onPress={onPress}
      style={({ pressed }) => [pressed && { backgroundColor: colors.border }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: radii.lg, overflow: "hidden" },
  row: { minHeight: sizes.minTouch + 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
});

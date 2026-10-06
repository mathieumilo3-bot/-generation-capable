import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from "react-native";
import { colors, radii, sizes, type } from "../tokens";
import { haptics } from "../haptics";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: "large" | "small";
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  hapticOnPress?: boolean;
}

/**
 * Bouton : hauteur généreuse (56), rouge réservé au CTA principal.
 * `loading` bloque aussi les doubles clics (premier rempart avant l'idempotence serveur).
 */
export function Button({ label, variant = "primary", size = "large", loading, disabled, fullWidth = true, icon, style, hapticOnPress = true, onPress, ...rest }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={(e) => { if (hapticOnPress) haptics.confirm(); onPress?.(e); }}
      style={({ pressed }) => [
        styles.base,
        { height: size === "large" ? sizes.button : sizes.buttonSmall, alignSelf: fullWidth ? "stretch" : "flex-start" },
        variantStyle(variant, pressed, !!inactive),
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.onAccent : colors.accent} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[type.button, { color: labelColor(variant, !!inactive) }]} numberOfLines={1}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function variantStyle(v: ButtonVariant, pressed: boolean, inactive: boolean): ViewStyle {
  switch (v) {
    case "primary": return { backgroundColor: inactive ? colors.disabled : pressed ? colors.accentPressed : colors.accent };
    case "danger": return { backgroundColor: inactive ? colors.disabled : pressed ? colors.accentPressed : colors.accent };
    case "secondary": return { backgroundColor: pressed ? colors.border : colors.surface };
    case "ghost": return { backgroundColor: pressed ? colors.surface : "transparent" };
  }
}
function labelColor(v: ButtonVariant, inactive: boolean): string {
  if (inactive && (v === "secondary" || v === "ghost")) return colors.disabled;
  switch (v) {
    case "primary": case "danger": return colors.onAccent;
    case "secondary": return colors.text;
    case "ghost": return colors.accent;
  }
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.lg, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", minHeight: sizes.minTouch },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});

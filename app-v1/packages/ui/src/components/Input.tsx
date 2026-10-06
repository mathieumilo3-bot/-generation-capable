import React, { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { colors, radii, sizes, type } from "../tokens";
import { Text } from "./Text";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  multiline?: boolean;
}

/** Champ large, simple, rassurant. Libellé toujours visible (accessibilité), erreur en texte (pas seulement en couleur). */
export function Input({ label, error, hint, style, multiline, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="secondary" color="textSecondary">{label}</Text> : null}
      <TextInput
        accessibilityLabel={label ?? rest.placeholder}
        placeholderTextColor={colors.textSecondary}
        maxFontSizeMultiplier={1.5}
        multiline={multiline}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        style={[
          styles.input, type.body,
          multiline && { minHeight: 120, paddingTop: 16, textAlignVertical: "top" },
          focused && { borderColor: colors.accent, backgroundColor: colors.background },
          !!error && { borderColor: colors.accent },
          style,
        ]}
        {...rest}
      />
      {error ? <Text variant="caption" style={{ color: colors.accentPressed }} accessibilityLiveRegion="polite">{error}</Text>
        : hint ? <Text variant="caption" color="textSecondary">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: sizes.input, borderRadius: radii.md, paddingHorizontal: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "transparent", color: colors.text },
});

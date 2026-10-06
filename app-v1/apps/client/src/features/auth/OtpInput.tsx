import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Text, colors, radii } from "@app/ui";
import { OTP_LENGTH, sanitizeOtp } from "./logic";

/**
 * Saisie du code à 6 chiffres : un seul champ réel (collage, remplissage automatique iOS/Android,
 * lecteurs d'écran) affiché sous forme de 6 cases.
 */
export function OtpInput({ value, onChange, disabled, error }: { value: string; onChange: (v: string) => void; disabled?: boolean; error?: boolean }) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessible={false} style={styles.wrap}>
      <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const active = focused && i === Math.min(value.length, OTP_LENGTH - 1);
          return (
            <View key={i} style={[styles.box, active && { borderColor: colors.accent, backgroundColor: colors.background }, error && { borderColor: colors.accent }]}>
              <Text variant="title" maxFontSizeMultiplier={1.2}>{value[i] ?? ""}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(sanitizeOtp(t))}
        editable={!disabled}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        inputMode="numeric"
        caretHidden
        accessibilityLabel="Code à 6 chiffres"
        accessibilityHint="Saisissez le code reçu par e-mail"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  row: { flexDirection: "row", gap: 8 },
  box: { flex: 1, minHeight: 60, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  hidden: { ...StyleSheet.absoluteFill, opacity: 0.02, color: "transparent" },
});

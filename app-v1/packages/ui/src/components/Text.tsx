import React from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { colors, type, type TypeVariant } from "../tokens";

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: keyof typeof colors;
  align?: TextStyle["textAlign"];
}

/** Police système native (SF sur iOS, Roboto sur Android, system-ui sur le web). Dynamic Type actif, plafonné pour préserver la mise en page. */
export function Text({ variant = "body", color = "text", align, style, maxFontSizeMultiplier = 1.5, ...rest }: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[type[variant], { color: colors[color], textAlign: align }, variant === "money" && { fontVariant: ["tabular-nums"] }, style]}
      {...rest}
    />
  );
}

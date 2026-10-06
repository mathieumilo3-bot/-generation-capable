import React from "react";
import { Text, colors } from "@app/ui";
import { openLink } from "./openLink";

/** Lien inline (dans une phrase) vers un document juridique : souligné, rôle « lien », ouvert dans le navigateur. */
export function LegalLink({ url, label, variant = "secondary" }: { url: string; label: string; variant?: "caption" | "secondary" }) {
  return (
    <Text variant={variant} accessibilityRole="link" accessibilityLabel={label} onPress={() => void openLink(url)}
      style={{ color: colors.text, textDecorationLine: "underline", fontWeight: "600" }}>
      {label}
    </Text>
  );
}

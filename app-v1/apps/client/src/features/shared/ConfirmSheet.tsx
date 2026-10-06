import React from "react";
import { View } from "react-native";
import { Button, Sheet, Text, spacing } from "@app/ui";

/** Confirmation (fonctionne aussi sur le web, contrairement à Alert). */
export function ConfirmSheet({ visible, title, message, body, confirmLabel, cancelLabel = "Annuler", destructive, loading, onConfirm, onCancel }: {
  visible: boolean; title: string; message?: string; /** Alias de `message`. */ body?: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean; loading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onCancel} title={title}>
      {message ?? body ? <Text variant="body" color="textSecondary">{message ?? body}</Text> : null}
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <Button label={confirmLabel} variant={destructive ? "danger" : "primary"} loading={loading} onPress={onConfirm} />
        <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={loading} />
      </View>
    </Sheet>
  );
}

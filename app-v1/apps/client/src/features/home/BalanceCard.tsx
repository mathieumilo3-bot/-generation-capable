import React from "react";
import { View } from "react-native";
import { formatEuros } from "@app/domain";
import { Button, Card, Skeleton, Text } from "@app/ui";

/** SOLDE DISPONIBLE (euros, jamais de crédits) + « Ajouter » discret. */
export function BalanceCard({ availableCents, loading, failed, onRetry, onAdd }: {
  availableCents: number | null; loading: boolean; failed: boolean; onRetry: () => void; onAdd: () => void;
}) {
  return (
    <Card tone="surface">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" color="textSecondary" style={{ letterSpacing: 0.6, fontWeight: "600" }}>SOLDE DISPONIBLE</Text>
          {loading ? (
            <Skeleton height={44} width="55%" />
          ) : failed || availableCents === null ? (
            <View style={{ gap: 4 }}>
              <Text variant="bodyStrong">Solde momentanément indisponible.</Text>
              <Text variant="secondary" color="textSecondary">Votre argent est en sécurité.</Text>
            </View>
          ) : (
            <Text variant="money" accessibilityLabel={`Solde disponible : ${formatEuros(availableCents)}`} adjustsFontSizeToFit numberOfLines={1}>{formatEuros(availableCents)}</Text>
          )}
        </View>
        {failed ? (
          <Button label="Réessayer" variant="ghost" size="small" fullWidth={false} onPress={onRetry} />
        ) : (
          <Button label="Ajouter" variant="secondary" size="small" fullWidth={false} onPress={onAdd} />
        )}
      </View>
    </Card>
  );
}

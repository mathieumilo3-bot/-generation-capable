import React from "react";
import { View } from "react-native";
import { formatEuros } from "@app/domain";
import { Notice, spacing } from "@app/ui";
import { usePendingInvite } from "./pendingInvite";

/**
 * Applique une invitation commerciale reçue avant la connexion (lien profond → connexion → ici) et le dit clairement :
 * « 20,00 € ajoutés à votre solde ». Invisible tant qu'il n'y a rien à annoncer.
 */
export function InviteBanner() {
  const invite = usePendingInvite();
  if (invite.status === "idle" || invite.status === "applying") return null;
  const wrap = { paddingHorizontal: spacing.xl, paddingTop: spacing.md, alignItems: "center" as const };
  return (
    <View style={wrap}>
      <View style={{ width: "100%", maxWidth: 560 }}>
        {invite.status === "applied" ? (
          <Notice tone="success" icon="gift-outline"
            title={invite.creditedCents > 0 ? `${formatEuros(invite.creditedCents)} ajoutés à votre solde` : "Invitation acceptée"}
            body={invite.replayed ? "Cette invitation avait déjà été appliquée." : "Vous pouvez créer votre première vidéo."}
            actionLabel="OK" onAction={invite.dismiss} />
        ) : (
          <Notice tone="warning" icon="alert-circle-outline" title={invite.title} body={invite.detail} actionLabel="Fermer" onAction={invite.dismiss} />
        )}
      </View>
    </View>
  );
}

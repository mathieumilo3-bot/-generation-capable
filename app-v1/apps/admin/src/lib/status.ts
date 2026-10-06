import type { LedgerType } from "@app/domain";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";
export interface StatusView { label: string; tone: Tone }

export const JOB_STATUS_OPTIONS = [
  "created", "uploading", "queued", "preparing", "analyzing", "editing",
  "rendering", "quality_check", "completed", "failed", "cancelled",
] as const;

const JOB: Record<string, StatusView> = {
  created: { label: "Créé", tone: "neutral" },
  uploading: { label: "Envoi", tone: "info" },
  queued: { label: "En file", tone: "info" },
  preparing: { label: "Préparation", tone: "info" },
  analyzing: { label: "Analyse", tone: "info" },
  editing: { label: "Montage", tone: "info" },
  rendering: { label: "Rendu", tone: "info" },
  quality_check: { label: "Contrôle qualité", tone: "info" },
  completed: { label: "Terminé", tone: "success" },
  failed: { label: "Échec", tone: "danger" },
  cancelled: { label: "Annulé", tone: "neutral" },
};

export function jobStatus(status: string): StatusView {
  return JOB[status] ?? { label: status || "—", tone: "neutral" };
}

export function isFinalJobStatus(status: string): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

const PAYMENT: Record<string, StatusView> = {
  pending: { label: "En attente", tone: "neutral" },
  requires_action: { label: "Action requise", tone: "warning" },
  succeeded: { label: "Réussi", tone: "success" },
  failed: { label: "Échoué", tone: "danger" },
  canceled: { label: "Annulé", tone: "neutral" },
  refunded: { label: "Remboursé", tone: "warning" },
  partially_refunded: { label: "Remb. partiel", tone: "warning" },
};
export const PAYMENT_STATUS_OPTIONS = Object.keys(PAYMENT);
export function paymentStatus(status: string): StatusView {
  return PAYMENT[status] ?? { label: status || "—", tone: "neutral" };
}

const WEBHOOK: Record<string, StatusView> = {
  received: { label: "Reçu", tone: "info" },
  processed: { label: "Traité", tone: "success" },
  ignored: { label: "Ignoré", tone: "neutral" },
  failed: { label: "Échec", tone: "danger" },
};
export const WEBHOOK_STATUS_OPTIONS = Object.keys(WEBHOOK);
export function webhookStatus(status: string): StatusView {
  return WEBHOOK[status] ?? { label: status || "—", tone: "neutral" };
}

const SUPPORT: Record<string, StatusView> = {
  open: { label: "Ouvert", tone: "warning" },
  in_progress: { label: "En cours", tone: "info" },
  resolved: { label: "Résolu", tone: "success" },
};
export const SUPPORT_STATUS_OPTIONS = Object.keys(SUPPORT);
export function supportStatus(status: string): StatusView {
  return SUPPORT[status] ?? { label: status || "—", tone: "neutral" };
}

const SUPPORT_CATEGORY: Record<string, string> = {
  video_problem: "Problème vidéo",
  payment: "Paiement",
  account: "Compte",
  other: "Autre",
};
export const SUPPORT_CATEGORY_OPTIONS = Object.keys(SUPPORT_CATEGORY);
export function supportCategory(category: string): string {
  return SUPPORT_CATEGORY[category] ?? category;
}

export function customerStatus(status: string): StatusView {
  switch (status) {
    case "active": return { label: "Actif", tone: "success" };
    case "suspended": return { label: "Suspendu", tone: "danger" };
    case "deleted": return { label: "Supprimé", tone: "neutral" };
    default: return { label: status || "—", tone: "neutral" };
  }
}

export function walletStatus(status: string): StatusView {
  switch (status) {
    case "active": return { label: "Actif", tone: "success" };
    case "frozen": return { label: "Gelé", tone: "warning" };
    case "closed": return { label: "Clos", tone: "neutral" };
    default: return { label: status || "—", tone: "neutral" };
  }
}

export function eventLevel(level: string): StatusView {
  switch (level) {
    case "error": return { label: "Erreur", tone: "danger" };
    case "warn": return { label: "Alerte", tone: "warning" };
    case "debug": return { label: "Debug", tone: "neutral" };
    default: return { label: "Info", tone: "info" };
  }
}

const LEDGER: Record<LedgerType, string> = {
  topup: "Recharge",
  purchase: "Achat direct",
  hold: "Réservation",
  capture: "Encaissement",
  release: "Libération",
  refund: "Remboursement",
  bonus: "Bonus",
  manual_adjustment: "Ajustement manuel",
  commercial_credit: "Crédit commercial",
  promotion: "Promotion",
};
export function ledgerLabel(type: string): string {
  return (LEDGER as Record<string, string>)[type] ?? type;
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

/** Une invitation « pending » dont la date est dépassée est affichée « Expirée ». */
export function effectiveInvitationStatus(status: string, expiresAt: string, now: Date = new Date()): InvitationStatus {
  if (status === "accepted") return "accepted";
  if (status === "revoked") return "revoked";
  if (status === "expired") return "expired";
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t <= now.getTime() ? "expired" : "pending";
}

export function invitationStatus(status: InvitationStatus): StatusView {
  switch (status) {
    case "pending": return { label: "En attente", tone: "warning" };
    case "accepted": return { label: "Acceptée", tone: "success" };
    case "revoked": return { label: "Révoquée", tone: "danger" };
    case "expired": return { label: "Expirée", tone: "neutral" };
  }
}

export function dealStatus(status: string): StatusView {
  switch (status) {
    case "pending": return { label: "En attente", tone: "warning" };
    case "active": return { label: "Actif", tone: "success" };
    case "cancelled": return { label: "Annulé", tone: "danger" };
    default: return { label: status || "—", tone: "neutral" };
  }
}

export const AUDIT_ENTITIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "wallet", label: "Portefeuille" },
  { value: "video_job", label: "Job vidéo" },
  { value: "user", label: "Client" },
  { value: "commercial_deal", label: "Deal commercial" },
  { value: "invitation", label: "Invitation" },
  { value: "app_setting", label: "Réglage" },
  { value: "pricing_rule", label: "Règle tarifaire" },
];

export function auditEntityLabel(entity: string): string {
  return AUDIT_ENTITIES.find((e) => e.value === entity)?.label ?? entity;
}

import { asRecord, num, str, strOrNull, type JsonObject } from "../lib/decode";

export interface LedgerRow {
  id: string;
  type: string;
  amountCents: number;
  availableDeltaCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
  heldAfterCents: number;
  reference: string | null;
  jobId: string | null;
  projectId: string | null;
  paymentId: string | null;
  metadata: JsonObject;
  createdBy: string | null;
  createdAt: string;
}

export function decodeLedgerRow(r: JsonObject): LedgerRow {
  return {
    id: str(r.id),
    type: str(r.type),
    amountCents: num(r.amount_cents),
    availableDeltaCents: num(r.available_delta_cents),
    balanceBeforeCents: num(r.balance_before_cents),
    balanceAfterCents: num(r.balance_after_cents),
    heldAfterCents: num(r.held_after_cents),
    reference: strOrNull(r.reference),
    jobId: strOrNull(r.job_id),
    projectId: strOrNull(r.project_id),
    paymentId: strOrNull(r.payment_id),
    metadata: asRecord(r.metadata),
    createdBy: strOrNull(r.created_by),
    createdAt: str(r.created_at),
  };
}

/** Identifiants de jobs déjà remboursés (une écriture « refund » rattachée au job existe). */
export function refundedJobIds(rows: readonly LedgerRow[]): Set<string> {
  const ids = new Set<string>();
  for (const r of rows) if (r.type === "refund" && r.jobId) ids.add(r.jobId);
  return ids;
}

/** CA d'un job = marge + coût arrondi au centime supérieur (définition SQL de gross_margin_cents). */
export function revenueFromMargin(marginCents: number | null, costMicro: number | null): number | null {
  if (marginCents === null || costMicro === null) return null;
  return marginCents + Math.ceil(costMicro / 10_000);
}

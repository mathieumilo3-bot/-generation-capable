import type { AdminDb } from "./db";
import { asRecord, bool, num, str } from "../lib/decode";
import { AdminError } from "../lib/errors";
import type { AdjustKind } from "../lib/validation";

export interface AdjustWalletInput {
  walletId: string;
  kind: AdjustKind;
  /** Centimes entiers ; signé uniquement pour `manual_adjustment`. */
  amountCents: number;
  reason: string;
  /** Une clé par ouverture de dialogue (crypto.randomUUID). */
  idempotencyKey: string;
}

export interface AdjustWalletResult {
  transactionId: string;
  balanceAfterCents: number;
  replayed: boolean;
}

/** Toute opération financière passe par ce RPC (ledger + audit) : jamais d'UPDATE direct d'un solde. */
export async function adjustWallet(db: AdminDb, input: AdjustWalletInput): Promise<AdjustWalletResult> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents === 0) throw new AdminError("invalid_amount");
  if (input.idempotencyKey.length < 8) throw new AdminError("idempotency_key_required");
  const r = asRecord(await db.rpc("admin_adjust_wallet", {
    p_wallet_id: input.walletId,
    p_kind: input.kind,
    p_amount_cents: input.amountCents,
    p_reason: input.reason.trim(),
    p_idempotency_key: input.idempotencyKey,
  }));
  return { transactionId: str(r.transaction_id), balanceAfterCents: num(r.balance_after_cents), replayed: bool(r.replayed) };
}

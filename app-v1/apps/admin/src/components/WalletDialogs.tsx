import { useState } from "react";
import { formatEuros, newIdempotencyKey } from "@app/domain";
import { ActionDialog } from "./Dialog";
import { ReasonField, SelectField, TextField } from "./Fields";
import { Notice } from "./ui";
import { useBackend } from "../state/backend";
import { adjustWallet } from "../data/wallet";
import { setUserStatus } from "../data/customers";
import {
  ADJUST_KINDS, describeAdjustment, parseAmount, validateAdjustment, validateReason,
  type AdjustDirection, type AdjustKind,
} from "../lib/validation";

interface AdjustProps {
  walletId: string;
  balanceCents: number;
  heldCents: number;
  onClose: () => void;
  onDone: (message: string) => void;
}

/**
 * Ajustement de portefeuille (promotion, bonus, crédit commercial, correction) via le RPC
 * `admin_adjust_wallet` : transaction auditée, jamais d'UPDATE direct. Étape 2 = confirmation
 * explicite avec le montant en euros ; clé d'idempotence unique par ouverture.
 */
export function AdjustWalletDialog({ walletId, balanceCents, heldCents, onClose, onDone }: AdjustProps) {
  const { db } = useBackend();
  const [key] = useState(() => newIdempotencyKey("admadj"));
  const [kind, setKind] = useState<AdjustKind>("promotion");
  const [direction, setDirection] = useState<AdjustDirection>("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});

  const input = { kind, direction, amountInput: amount, reason, balanceCents, heldCents };
  const result = validateAdjustment(input);
  const kindMeta = ADJUST_KINDS.find((k) => k.value === kind);
  const preview = parseAmount(amount);
  const previewAfter = preview.ok
    ? balanceCents + (kind === "manual_adjustment" && direction === "debit" ? -preview.cents : preview.cents)
    : null;

  return (
    <ActionDialog
      title="Ajuster le solde"
      description={<>Solde actuel : <strong>{formatEuros(balanceCents)}</strong> dont {formatEuros(heldCents)} réservés par des montages en cours.</>}
      onClose={onClose}
      form={(
        <>
          <SelectField
            label="Type d'opération"
            value={kind}
            onChange={(e) => setKind(e.target.value as AdjustKind)}
            hint={kindMeta?.hint}
          >
            {ADJUST_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </SelectField>
          {kind === "manual_adjustment" ? (
            <SelectField label="Sens" value={direction} onChange={(e) => setDirection(e.target.value as AdjustDirection)}>
              <option value="credit">Ajouter au solde</option>
              <option value="debit">Retirer du solde</option>
            </SelectField>
          ) : null}
          <TextField
            label="Montant (en euros)"
            inputMode="decimal"
            placeholder="ex. 25 ou 25,50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.amount}
            hint={previewAfter !== null ? `Nouveau solde : ${formatEuros(previewAfter)}` : undefined}
            autoComplete="off"
            required
          />
          <ReasonField value={reason} onChange={setReason} error={errors.reason} />
        </>
      )}
      validate={() => {
        if (result.ok) {
          setErrors({});
          return true;
        }
        setErrors(result.errors);
        return false;
      }}
      summary={result.ok ? (
        <>
          <p className="confirm__amount">{formatEuros(result.amountCents, { signed: true })}</p>
          <p><strong>{describeAdjustment(result.kind, result.amountCents)}</strong></p>
          <p>Solde : {formatEuros(balanceCents)} → <strong>{formatEuros(result.balanceAfterCents)}</strong></p>
          <p className="muted">Motif : {result.reason}</p>
          <p className="muted small">Opération irréversible : seule une écriture inverse pourra la corriger. Elle apparaîtra dans le ledger et le journal d'audit.</p>
        </>
      ) : <Notice tone="error">Formulaire invalide.</Notice>}
      confirmLabel={result.ok ? `Confirmer : ${describeAdjustment(result.kind, result.amountCents).toLowerCase()}` : "Confirmer"}
      danger={result.ok && result.amountCents < 0}
      onConfirm={async () => {
        if (!result.ok) throw new Error("Formulaire invalide.");
        await adjustWallet(db, { walletId, kind: result.kind, amountCents: result.amountCents, reason: result.reason, idempotencyKey: key });
      }}
      onDone={() => onDone(result.ok ? `${describeAdjustment(result.kind, result.amountCents)} : enregistré.` : "Enregistré.")}
    />
  );
}

interface StatusProps {
  userId: string;
  target: "active" | "suspended";
  onClose: () => void;
  onDone: (message: string) => void;
}

export function SetStatusDialog({ userId, target, onClose, onDone }: StatusProps) {
  const { db } = useBackend();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const suspend = target === "suspended";
  return (
    <ActionDialog
      title={suspend ? "Suspendre ce client" : "Réactiver ce client"}
      description={suspend
        ? "Le compte est suspendu et son portefeuille est gelé : aucune nouvelle commande ni dépense tant que le compte n'est pas réactivé. Le solde n'est pas modifié."
        : "Le compte est réactivé et son portefeuille est dégelé. Le solde n'est pas modifié."}
      onClose={onClose}
      form={<ReasonField value={reason} onChange={setReason} error={reasonError} />}
      validate={() => {
        const err = validateReason(reason);
        setReasonError(err ?? undefined);
        return err === null;
      }}
      summary={(
        <>
          <p><strong>{suspend ? "Suspendre" : "Réactiver"}</strong> le compte client.</p>
          <p className="muted">Motif : {reason.trim()}</p>
        </>
      )}
      confirmLabel={suspend ? "Suspendre le compte" : "Réactiver le compte"}
      danger={suspend}
      onConfirm={() => setUserStatus(db, userId, target, reason)}
      onDone={() => onDone(suspend ? "Compte suspendu." : "Compte réactivé.")}
    />
  );
}

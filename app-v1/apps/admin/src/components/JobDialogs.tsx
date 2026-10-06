import { useState } from "react";
import { formatEuros, newIdempotencyKey } from "@app/domain";
import { ActionDialog } from "./Dialog";
import { ReasonField } from "./Fields";
import { Notice } from "./ui";
import { useBackend } from "../state/backend";
import { refundJob, retryJob } from "../data/jobs";
import { humanizeAdminCode } from "../lib/errors";
import { validateReason } from "../lib/validation";

interface Common {
  jobId: string;
  priceCents: number;
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Remboursement d'un job : montant en euros affiché, motif obligatoire, clé d'idempotence par ouverture. */
export function RefundJobDialog({ jobId, priceCents, onClose, onDone }: Common) {
  const { db } = useBackend();
  const [key] = useState(() => newIdempotencyKey("admref"));
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();

  return (
    <ActionDialog
      title="Rembourser ce job"
      description="Le montant encaissé pour ce job est reversé sur le solde du client (écriture « Remboursement » dans le ledger, tracée dans l'audit). Le client est notifié."
      onClose={onClose}
      form={<ReasonField value={reason} onChange={setReason} error={reasonError} />}
      validate={() => {
        const err = validateReason(reason);
        setReasonError(err ?? undefined);
        return err === null;
      }}
      summary={(
        <>
          <p className="confirm__amount">{formatEuros(priceCents)}</p>
          <p>
            Vous allez <strong>rembourser {formatEuros(priceCents)}</strong> au client pour le job <span className="mono">{jobId.slice(0, 8)}</span>.
          </p>
          <p className="muted">Motif : {reason.trim()}</p>
        </>
      )}
      confirmLabel={`Rembourser ${formatEuros(priceCents)}`}
      danger
      onConfirm={async () => {
        const res = await refundJob(db, jobId, reason, key);
        if (!res.ok) throw new Error(humanizeAdminCode(res.code));
      }}
      onDone={() => onDone(`Remboursement de ${formatEuros(priceCents)} enregistré.`)}
    />
  );
}

/** Relance « sûre » : nouveau montant réservé, jamais de double encaissement. */
export function RetryJobDialog({ jobId, priceCents, onClose, onDone }: Common) {
  const { db } = useBackend();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();

  return (
    <ActionDialog
      title="Relancer ce job"
      onClose={onClose}
      description={(
        <Notice tone="info" title="Sécurité financière">
          Un <strong>nouveau montant de {formatEuros(priceCents)} est réservé</strong> sur le solde du client au moment de la relance.
          L'ancienne réservation a déjà été libérée : le client n'est <strong>jamais encaissé deux fois</strong>.
          Si son solde disponible est insuffisant, la relance est refusée et rien n'est modifié.
        </Notice>
      )}
      form={<ReasonField value={reason} onChange={setReason} error={reasonError} />}
      validate={() => {
        const err = validateReason(reason);
        setReasonError(err ?? undefined);
        return err === null;
      }}
      summary={(
        <>
          <p className="confirm__amount">{formatEuros(priceCents)}</p>
          <p>Le job <span className="mono">{jobId.slice(0, 8)}</span> repasse en file d'attente et <strong>{formatEuros(priceCents)}</strong> sont réservés sur le solde du client.</p>
          <p className="muted">Motif : {reason.trim()}</p>
        </>
      )}
      confirmLabel="Relancer le job"
      onConfirm={async () => {
        const res = await retryJob(db, jobId, reason);
        if (!res.ok) throw new Error(humanizeAdminCode(res.code, res.shortfallCents !== undefined ? { shortfallCents: res.shortfallCents } : {}));
      }}
      onDone={() => onDone("Job relancé : il est de nouveau en file d'attente.")}
    />
  );
}

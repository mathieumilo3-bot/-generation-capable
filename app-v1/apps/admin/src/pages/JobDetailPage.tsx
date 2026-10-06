import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEuros } from "@app/domain";
import { useBackend } from "../state/backend";
import { useStaff } from "../state/auth";
import { useAsync } from "../hooks/useAsync";
import { canRefund, canRetry, fetchJobDetail, type JobDetail } from "../data/jobs";
import { Badge, Button, Card, CopyButton, JsonView, KeyValue, Loadable, Notice, PageHeader, ReadOnlyHint, Stat } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
import { RefundJobDialog, RetryJobDialog } from "../components/JobDialogs";
import type { LedgerRow } from "../data/ledger";
import type { JobEvent } from "../data/jobs";
import { formatDateTime, formatMicroEuros, formatSignedEuros, formatTime } from "../lib/format";
import { eventLevel, jobStatus, ledgerLabel } from "../lib/status";
import { isUuid } from "../lib/validation";
import { BarList } from "../components/Charts";

function Costs({ detail }: { detail: JobDetail }) {
  const c = detail.costs;
  if (!c) return <p className="muted">Aucun coût enregistré pour ce job (le coût réel est saisi à la fin du rendu).</p>;
  return (
    <>
      <BarList
        ariaLabel="Coûts moteur par catégorie"
        items={c.categories.map((x) => ({ key: x.key, label: x.label, value: x.micro, display: formatMicroEuros(x.micro), tone: "muted" as const }))}
      />
      <div className="grid grid--3 mt">
        <Stat label="Coût réel total" value={formatMicroEuros(c.totalMicro)} hint={c.fxRateUsdEur !== null ? `Taux USD→EUR ${c.fxRateUsdEur}` : undefined} />
        <Stat label="CA (encaissé)" value={formatEuros(c.revenueCents)} />
        <Stat label="Marge brute" value={formatEuros(c.marginCents)} tone={c.marginCents < 0 ? "danger" : "success"} />
      </div>
    </>
  );
}

export function JobDetailPage() {
  const { jobId = "" } = useParams();
  const { db } = useBackend();
  const { canWrite, role } = useStaff();
  const valid = isUuid(jobId);
  const result = useAsync(() => (valid ? fetchJobDetail(db, jobId) : Promise.reject(new Error("job_not_found"))), [db, jobId]);
  const [dialog, setDialog] = useState<"retry" | "refund" | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const eventColumns: Column<JobEvent>[] = [
    { key: "time", header: "Heure", render: (e) => <span title={formatDateTime(e.createdAt)}>{formatTime(e.createdAt)}</span> },
    { key: "level", header: "Niveau", render: (e) => { const l = eventLevel(e.level); return <Badge tone={l.tone}>{l.label}</Badge>; } },
    { key: "source", header: "Source", render: (e) => e.source },
    { key: "stage", header: "Étape", render: (e) => e.stage ?? "—" },
    { key: "message", header: "Message", render: (e) => e.message },
    { key: "corr", header: "Corrélation", render: (e) => <span className="mono" title={e.correlationId}>{e.correlationId.slice(0, 8)}</span> },
    { key: "data", header: "Données", render: (e) => <JsonView value={e.data} summary="Voir" /> },
  ];

  const txColumns: Column<LedgerRow>[] = [
    { key: "date", header: "Date", render: (t) => formatDateTime(t.createdAt) },
    { key: "type", header: "Type", render: (t) => ledgerLabel(t.type) },
    { key: "amount", header: "Montant", align: "right", render: (t) => formatEuros(t.amountCents) },
    { key: "delta", header: "Δ disponible", align: "right", render: (t) => formatSignedEuros(t.availableDeltaCents) },
    { key: "bal", header: "Solde après", align: "right", render: (t) => formatEuros(t.balanceAfterCents) },
    { key: "ref", header: "Référence", render: (t) => t.reference ?? "—" },
  ];

  return (
    <Loadable result={result}>
      {(d) => {
        const s = jobStatus(d.job.status);
        const refundable = canRefund(d.job, d.transactions);
        const alreadyRefunded = d.job.status === "completed" && d.transactions.some((t) => t.type === "refund");
        return (
          <>
            <PageHeader
              title={`Job ${d.job.id.slice(0, 8)}`}
              subtitle={<><Badge tone={s.tone}>{s.label}</Badge> · créé le {formatDateTime(d.job.createdAt)} · <Link to="/jobs">Retour à la liste</Link></>}
              actions={canWrite ? (
                <>
                  {canRetry(d.job.status) ? <Button variant="primary" onClick={() => setDialog("retry")}>Relancer</Button> : null}
                  {refundable ? <Button variant="danger" onClick={() => setDialog("refund")}>Rembourser {formatEuros(d.job.priceCents)}</Button> : null}
                </>
              ) : null}
            />
            {!canWrite ? <ReadOnlyHint role={role} /> : null}
            {flash ? <Notice tone="success" onDismiss={() => setFlash(null)}>{flash}</Notice> : null}
            {alreadyRefunded ? <Notice tone="info">Ce job a déjà été remboursé (voir les transactions ci-dessous).</Notice> : null}
            {canWrite && canRetry(d.job.status) ? (
              <Notice tone="info" title="Relance sûre">
                « Relancer » réserve un nouveau montant ({formatEuros(d.job.priceCents)}) sur le solde du client ; l'ancien n'est jamais encaissé deux fois.
              </Notice>
            ) : null}

            <div className="grid grid--2">
              <Card title="Résumé">
                <KeyValue items={[
                  { label: "Client", value: <Link to={`/clients/${d.job.userId}`}>{d.job.userId.slice(0, 8)}</Link> },
                  { label: "Type", value: d.job.kind === "revision" ? "Modification" : "Création" },
                  { label: "Mode · méthode", value: `${d.job.sourceMode}${d.job.editingMethodSlug ? ` · ${d.job.editingMethodSlug}` : ""}` },
                  { label: "Durée · format", value: `${d.job.requestedDurationSec} s · ${d.job.aspectRatio}` },
                  { label: "Prix", value: formatEuros(d.job.priceCents) },
                  { label: "Progression", value: `${d.job.progress} %${d.job.currentStage ? ` · ${d.job.currentStage}` : ""}` },
                  { label: "Essais", value: `${d.job.attemptCount} / ${d.job.maxAttempts}` },
                  { label: "Erreur", value: d.job.errorCode ? <code className="code">{d.job.errorCode}</code> : "—" },
                  { label: "Démarré", value: formatDateTime(d.job.startedAt) },
                  { label: "Terminé", value: formatDateTime(d.job.completedAt) },
                  { label: "Instructions", value: d.job.instructions ?? "—" },
                  { label: "Corrélation", value: <span className="mono">{d.job.correlationId} <CopyButton small text={d.job.correlationId} /></span> },
                ]} />
              </Card>
              <Card title="Coûts par catégorie">
                <Costs detail={d} />
              </Card>
            </div>

            <Card title={`Chronologie (${d.events.length})`}>
              <DataTable caption="Événements du job" columns={eventColumns} rows={d.events} rowKey={(e) => String(e.id)} emptyTitle="Aucun événement" rowClassName={(e) => e.level === "error" ? "row--danger" : undefined} />
            </Card>

            <div className="grid grid--2">
              <Card title="Transactions liées">
                <DataTable caption="Transactions du ledger liées au job" columns={txColumns} rows={d.transactions} rowKey={(t) => t.id} emptyTitle="Aucune transaction" />
              </Card>
              <Card title="Données internes (moteur)">
                {d.internals ? (
                  <>
                    <KeyValue items={[
                      { label: "Version du moteur", value: d.internals.engineVersion ?? "—" },
                      { label: "Référence moteur", value: d.internals.engineJobRef ? <span className="mono">{d.internals.engineJobRef}</span> : "—" },
                      { label: "Verrou", value: d.internals.lockedBy ?? "—" },
                      { label: "Erreur interne", value: d.internals.errorMessageInternal ?? "—" },
                      { label: "Projet", value: <span className="mono">{d.job.projectId.slice(0, 8)}</span> },
                    ]} />
                    <JsonView value={d.internals.inputManifest} summary="Manifeste d'entrée" />
                  </>
                ) : <p className="muted">Aucune donnée interne.</p>}
              </Card>
            </div>

            {dialog === "retry" ? (
              <RetryJobDialog jobId={d.job.id} priceCents={d.job.priceCents} onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); setFlash(m); result.reload(); }} />
            ) : null}
            {dialog === "refund" ? (
              <RefundJobDialog jobId={d.job.id} priceCents={d.job.priceCents} onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); setFlash(m); result.reload(); }} />
            ) : null}
          </>
        );
      }}
    </Loadable>
  );
}

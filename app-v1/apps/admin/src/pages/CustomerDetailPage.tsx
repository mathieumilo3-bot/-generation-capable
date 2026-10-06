import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEuros } from "@app/domain";
import { useBackend } from "../state/backend";
import { useStaff } from "../state/auth";
import { useAsync } from "../hooks/useAsync";
import {
  addNote, customerDisplayName, fetchCustomerDetail,
  type CustomerDetail, type CustomerJob, type CustomerNote, type CustomerPayment, type CustomerProject,
} from "../data/customers";
import { refundedJobIds, type LedgerRow } from "../data/ledger";
import type { SupportRequest } from "../data/support";
import { Badge, Button, Card, EmptyState, JsonView, KeyValue, Loadable, Notice, PageHeader, ReadOnlyHint, Stat, TabPanel, Tabs } from "../components/ui";
import { TextArea } from "../components/Fields";
import { DataTable, IdLink, type Column } from "../components/DataTable";
import { AdjustWalletDialog, SetStatusDialog } from "../components/WalletDialogs";
import { RefundJobDialog } from "../components/JobDialogs";
import { errorMessage } from "../lib/errors";
import { formatDateTime, formatMicroEuros, formatRelative, formatSignedEuros, truncate } from "../lib/format";
import {
  customerStatus, jobStatus, ledgerLabel, paymentStatus, supportCategory, supportStatus, walletStatus,
} from "../lib/status";
import { isUuid, NOTE_MAX, validateNote } from "../lib/validation";

type TabId = "finances" | "jobs" | "payments" | "errors" | "notes" | "support";

function NotesPanel({ detail, canWrite, onSaved }: { detail: CustomerDetail; canWrite: boolean; onSaved: () => void }) {
  const { db } = useBackend();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const err = validateNote(note);
    if (err) { setError(err); return; }
    setBusy(true);
    setError(undefined);
    try {
      await addNote(db, detail.profile.id, note);
      setNote("");
      onSaved();
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<CustomerNote>[] = [
    { key: "date", header: "Date", render: (n) => formatDateTime(n.createdAt) },
    { key: "author", header: "Auteur", render: (n) => n.authorId ? <span className="mono">{n.authorId.slice(0, 8)}</span> : "—" },
    { key: "note", header: "Note", render: (n) => <span className="pre-wrap">{n.note}</span> },
  ];

  return (
    <>
      {canWrite ? (
        <form onSubmit={submit} className="note-form">
          <TextArea
            label="Nouvelle note interne"
            hint="Visible uniquement par l'équipe. Jamais par le client."
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={error}
          />
          <Button type="submit" variant="primary" busy={busy}>Ajouter la note</Button>
        </form>
      ) : null}
      <DataTable caption="Notes internes" columns={columns} rows={detail.notes} rowKey={(n) => n.id} emptyTitle="Aucune note interne" />
    </>
  );
}

export function CustomerDetailPage() {
  const { userId = "" } = useParams();
  const { db } = useBackend();
  const { canWrite, role } = useStaff();
  const valid = isUuid(userId);
  const result = useAsync(() => (valid ? fetchCustomerDetail(db, userId) : Promise.reject(new Error("user_not_found"))), [db, userId]);
  const [tab, setTab] = useState<TabId>("finances");
  const [flash, setFlash] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { kind: "adjust" }
    | { kind: "status"; target: "active" | "suspended" }
    | { kind: "refund"; job: CustomerJob }
    | null
  >(null);

  const done = (message: string) => {
    setDialog(null);
    setFlash(message);
    result.reload();
  };

  return (
    <Loadable result={result}>
      {(d) => {
        const p = d.profile;
        const st = customerStatus(p.status);
        const refunded = refundedJobIds(d.transactions);
        const available = d.wallet ? d.wallet.balanceCents - d.wallet.heldCents : 0;
        const failedJobs = d.jobs.filter((j) => j.errorCode || j.status === "failed");
        const failedPayments = d.payments.filter((x) => x.failureCode || x.status === "failed");
        const errorCount = failedJobs.length + failedPayments.length;

        const ledgerColumns: Column<LedgerRow>[] = [
          { key: "date", header: "Date", render: (t) => formatDateTime(t.createdAt) },
          { key: "type", header: "Type", render: (t) => ledgerLabel(t.type) },
          { key: "amount", header: "Montant", align: "right", render: (t) => formatEuros(t.amountCents) },
          { key: "delta", header: "Δ disponible", align: "right", render: (t) => <span className={t.availableDeltaCents < 0 ? "neg" : t.availableDeltaCents > 0 ? "pos" : undefined}>{formatSignedEuros(t.availableDeltaCents)}</span> },
          { key: "bal", header: "Solde après", align: "right", render: (t) => formatEuros(t.balanceAfterCents) },
          { key: "ref", header: "Référence / motif", render: (t) => {
            const reason = typeof t.metadata.admin_reason === "string" ? t.metadata.admin_reason : null;
            return reason ? <span title={t.reference ?? undefined}>{truncate(reason, 80)}</span> : t.reference ?? "—";
          } },
          { key: "job", header: "Job", render: (t) => <IdLink to={`/jobs/${t.jobId ?? ""}`} id={t.jobId} /> },
        ];

        const projectColumns: Column<CustomerProject>[] = [
          { key: "date", header: "Créé le", render: (x) => formatDateTime(x.createdAt) },
          { key: "title", header: "Titre", render: (x) => x.title },
          { key: "status", header: "Statut", render: (x) => x.status },
          { key: "mode", header: "Mode", render: (x) => x.sourceMode },
          { key: "id", header: "Identifiant", render: (x) => <span className="mono">{x.id.slice(0, 8)}</span> },
        ];

        const jobColumns: Column<CustomerJob>[] = [
          { key: "date", header: "Créé le", render: (j) => formatDateTime(j.createdAt) },
          { key: "id", header: "Job", render: (j) => <Link to={`/jobs/${j.id}`} className="mono">{j.id.slice(0, 8)}</Link> },
          { key: "status", header: "Statut", render: (j) => { const s = jobStatus(j.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
          { key: "price", header: "Prix", align: "right", render: (j) => formatEuros(j.priceCents) },
          { key: "rev", header: "CA", align: "right", render: (j) => j.revenueCents === null ? "—" : formatEuros(j.revenueCents) },
          { key: "cost", header: "Coût réel", align: "right", render: (j) => j.costMicro === null ? "—" : formatMicroEuros(j.costMicro) },
          { key: "margin", header: "Marge", align: "right", render: (j) => j.marginCents === null ? "—" : formatEuros(j.marginCents) },
          { key: "err", header: "Erreur", render: (j) => j.errorCode ? <code className="code">{j.errorCode}</code> : "—" },
          { key: "act", header: "Action", render: (j) => {
            if (j.status !== "completed" || j.priceCents <= 0) return null;
            if (refunded.has(j.id)) return <Badge tone="warning">Remboursé</Badge>;
            return canWrite ? <Button small variant="danger" onClick={() => setDialog({ kind: "refund", job: j })}>Rembourser</Button> : null;
          } },
        ];

        const paymentColumns: Column<CustomerPayment>[] = [
          { key: "date", header: "Date", render: (x) => formatDateTime(x.createdAt) },
          { key: "provider", header: "Fournisseur", render: (x) => x.provider },
          { key: "kind", header: "Type", render: (x) => x.kind === "auto_reload" ? "Recharge auto" : "Recharge" },
          { key: "amount", header: "Montant", align: "right", render: (x) => formatEuros(x.amountCents) },
          { key: "refunded", header: "Remboursé", align: "right", render: (x) => x.refundedCents > 0 ? formatEuros(x.refundedCents) : "—" },
          { key: "status", header: "Statut", render: (x) => { const s = paymentStatus(x.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
          { key: "platform", header: "Plateforme", render: (x) => x.platform ?? "—" },
        ];

        const supportColumns: Column<SupportRequest>[] = [
          { key: "date", header: "Date", render: (s) => formatDateTime(s.createdAt) },
          { key: "status", header: "Statut", render: (s) => { const v = supportStatus(s.status); return <Badge tone={v.tone}>{v.label}</Badge>; } },
          { key: "cat", header: "Catégorie", render: (s) => supportCategory(s.category) },
          { key: "msg", header: "Message", render: (s) => <span className="pre-wrap">{truncate(s.message, 200)}</span> },
          { key: "job", header: "Job", render: (s) => <IdLink to={`/jobs/${s.jobId ?? ""}`} id={s.jobId} /> },
        ];

        return (
          <>
            <PageHeader
              title={customerDisplayName(p)}
              subtitle={<><Badge tone={st.tone}>{st.label}</Badge> · {p.email ?? "sans e-mail"}{p.company ? ` · ${p.company}` : ""} · <Link to="/clients">Retour aux clients</Link></>}
              actions={canWrite ? (
                <>
                  {d.wallet && d.wallet.status !== "closed" ? <Button variant="primary" onClick={() => setDialog({ kind: "adjust" })}>Ajuster le solde</Button> : null}
                  {p.status === "active" ? <Button variant="danger" onClick={() => setDialog({ kind: "status", target: "suspended" })}>Suspendre</Button> : null}
                  {p.status === "suspended" ? <Button onClick={() => setDialog({ kind: "status", target: "active" })}>Réactiver</Button> : null}
                </>
              ) : null}
            />
            {!canWrite ? <ReadOnlyHint role={role} /> : null}
            {flash ? <Notice tone="success" onDismiss={() => setFlash(null)}>{flash}</Notice> : null}
            {p.status === "suspended" ? <Notice tone="warning" title="Compte suspendu">Le portefeuille est gelé : le client ne peut plus commander.</Notice> : null}

            <section aria-label="Indicateurs du client" className="grid grid--kpi">
              <Stat label="Solde disponible" value={d.wallet ? formatEuros(available) : "—"} hint={d.wallet ? `Réservé : ${formatEuros(d.wallet.heldCents)}` : "Aucun portefeuille"} />
              <Stat label="Portefeuille" value={d.wallet ? <Badge tone={walletStatus(d.wallet.status).tone}>{walletStatus(d.wallet.status).label}</Badge> : "—"} />
              <Stat label="CA cumulé" value={formatEuros(d.totals.revenueCents)} />
              <Stat label="Coût moteur cumulé" value={formatMicroEuros(d.totals.costMicro)} />
              <Stat label="Marge cumulée" value={formatEuros(d.totals.marginCents)} tone={d.totals.marginCents < 0 ? "danger" : undefined} />
            </section>

            <Card title="Profil">
              <div className="grid grid--2">
                <KeyValue items={[
                  { label: "Identifiant", value: <span className="mono">{p.id}</span> },
                  { label: "E-mail", value: p.email ?? "—" },
                  { label: "Entreprise", value: p.company ?? "—" },
                  { label: "Langue", value: p.locale },
                  { label: "Créé le", value: formatDateTime(p.createdAt) },
                  { label: "Dernière activité", value: p.lastSeenAt ? `${formatRelative(p.lastSeenAt)} (${formatDateTime(p.lastSeenAt)})` : "—" },
                  { label: "Plateforme · version", value: `${p.platform ?? "—"} · ${p.appVersion ?? "—"}` },
                ]} />
                <KeyValue items={[
                  { label: "Acquisition", value: <JsonView value={p.acquisition} summary="Source, campagne, deal" /> },
                  { label: "Facturation", value: <JsonView value={p.billing} summary="Coordonnées de facturation" /> },
                ]} />
              </div>
            </Card>

            <Card>
              <Tabs<TabId>
                label="Sections de la fiche client"
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: "finances", label: `Historique financier (${d.transactions.length})` },
                  { id: "jobs", label: `Projets et jobs (${d.jobs.length})` },
                  { id: "payments", label: `Paiements (${d.payments.length})` },
                  { id: "errors", label: `Erreurs (${errorCount})` },
                  { id: "notes", label: `Notes (${d.notes.length})` },
                  { id: "support", label: `Support (${d.supportRequests.length})` },
                ]}
              />
              <TabPanel id="finances" active={tab === "finances"}>
                <DataTable caption="Historique financier (ledger, 100 dernières écritures)" columns={ledgerColumns} rows={d.transactions} rowKey={(t) => t.id} emptyTitle="Aucune écriture" />
              </TabPanel>
              <TabPanel id="jobs" active={tab === "jobs"}>
                <h3 className="subtitle">Jobs</h3>
                <DataTable caption="Jobs du client" columns={jobColumns} rows={d.jobs} rowKey={(j) => j.id} emptyTitle="Aucun job" rowClassName={(j) => j.status === "failed" ? "row--danger" : undefined} />
                <h3 className="subtitle">Projets</h3>
                <DataTable caption="Projets du client" columns={projectColumns} rows={d.projects} rowKey={(x) => x.id} emptyTitle="Aucun projet" />
              </TabPanel>
              <TabPanel id="payments" active={tab === "payments"}>
                <DataTable caption="Paiements du client" columns={paymentColumns} rows={d.payments} rowKey={(x) => x.id} emptyTitle="Aucun paiement" />
              </TabPanel>
              <TabPanel id="errors" active={tab === "errors"}>
                {errorCount === 0 ? <EmptyState title="Aucune erreur">Ni job en échec, ni paiement refusé pour ce client.</EmptyState> : (
                  <ul className="todo">
                    {failedJobs.map((j) => (
                      <li key={`j-${j.id}`}>
                        <span>Job <Link to={`/jobs/${j.id}`} className="mono">{j.id.slice(0, 8)}</Link> · {j.errorCode ? <code className="code">{j.errorCode}</code> : "échec"}</span>
                        <span className="muted small">{formatDateTime(j.createdAt)}</span>
                      </li>
                    ))}
                    {failedPayments.map((x) => (
                      <li key={`p-${x.id}`}>
                        <span>Paiement de {formatEuros(x.amountCents)} ({x.provider}) · {x.failureCode ? <code className="code">{x.failureCode}</code> : "échec"}{x.failureDetail ? <span className="muted"> — {truncate(x.failureDetail, 120)}</span> : null}</span>
                        <span className="muted small">{formatDateTime(x.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabPanel>
              <TabPanel id="notes" active={tab === "notes"}>
                <NotesPanel detail={d} canWrite={canWrite} onSaved={() => { setFlash("Note ajoutée."); result.reload(); }} />
              </TabPanel>
              <TabPanel id="support" active={tab === "support"}>
                <DataTable caption="Demandes de support du client" columns={supportColumns} rows={d.supportRequests} rowKey={(s) => s.id} emptyTitle="Aucune demande de support" />
              </TabPanel>
            </Card>

            {dialog?.kind === "adjust" && d.wallet ? (
              <AdjustWalletDialog walletId={d.wallet.id} balanceCents={d.wallet.balanceCents} heldCents={d.wallet.heldCents} onClose={() => setDialog(null)} onDone={done} />
            ) : null}
            {dialog?.kind === "status" ? (
              <SetStatusDialog userId={p.id} target={dialog.target} onClose={() => setDialog(null)} onDone={done} />
            ) : null}
            {dialog?.kind === "refund" ? (
              <RefundJobDialog jobId={dialog.job.id} priceCents={dialog.job.priceCents} onClose={() => setDialog(null)} onDone={done} />
            ) : null}
          </>
        );
      }}
    </Loadable>
  );
}

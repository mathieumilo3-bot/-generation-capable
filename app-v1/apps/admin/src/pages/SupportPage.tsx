import { useState } from "react";
import { Link } from "react-router-dom";
import { useBackend } from "../state/backend";
import { useAsync } from "../hooks/useAsync";
import { useUrlState } from "../hooks/useUrlState";
import { listSupportRequests, updateSupportRequest, STAFF_NOTES_MAX, type SupportRequest, type SupportStatus } from "../data/support";
import { Badge, Button, Card, Loadable, Notice, PageHeader } from "../components/ui";
import { SelectField, TextArea } from "../components/Fields";
import { ActionDialog } from "../components/Dialog";
import { DataTable, IdLink, Pagination, type Column } from "../components/DataTable";
import { formatDateTime, truncate } from "../lib/format";
import { pageRequest } from "../lib/pagination";
import { SUPPORT_CATEGORY_OPTIONS, SUPPORT_STATUS_OPTIONS, supportCategory, supportStatus } from "../lib/status";

function SupportDialog({ request, onClose, onDone }: { request: SupportRequest; onClose: () => void; onDone: () => void }) {
  const { db } = useBackend();
  const [status, setStatus] = useState<SupportStatus>(request.status === "in_progress" || request.status === "resolved" ? request.status : "open");
  const [notes, setNotes] = useState(request.staffNotes ?? "");
  const [error, setError] = useState<string | undefined>();
  return (
    <ActionDialog
      title="Suivre la demande"
      description={<span className="pre-wrap">{truncate(request.message, 300)}</span>}
      onClose={onClose}
      form={(
        <>
          <SelectField label="Statut" value={status} onChange={(e) => setStatus(e.target.value as SupportStatus)}>
            {SUPPORT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{supportStatus(s).label}</option>)}
          </SelectField>
          <TextArea label="Note interne" hint="Visible uniquement par l'équipe." rows={4} maxLength={STAFF_NOTES_MAX} value={notes} onChange={(e) => setNotes(e.target.value)} error={error} />
        </>
      )}
      validate={() => {
        if (notes.length > STAFF_NOTES_MAX) { setError(`${STAFF_NOTES_MAX} caractères maximum.`); return false; }
        setError(undefined);
        return true;
      }}
      summary={(
        <>
          <p>Statut : <strong>{supportStatus(status).label}</strong></p>
          <p className="muted pre-wrap">Note : {notes.trim() === "" ? "aucune" : notes.trim()}</p>
        </>
      )}
      confirmLabel="Enregistrer"
      onConfirm={() => updateSupportRequest(db, request.id, status, notes)}
      onDone={onDone}
    />
  );
}

export function SupportPage() {
  const { db } = useBackend();
  const { values, page, setFilter, setPage } = useUrlState(["status", "category"] as const);
  const [editing, setEditing] = useState<SupportRequest | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const result = useAsync(() => listSupportRequests(db, { status: values.status, category: values.category }, pageRequest(page)), [db, values.status, values.category, page]);

  const columns: Column<SupportRequest>[] = [
    { key: "date", header: "Date", render: (s) => formatDateTime(s.createdAt) },
    { key: "status", header: "Statut", render: (s) => { const v = supportStatus(s.status); return <Badge tone={v.tone}>{v.label}</Badge>; } },
    { key: "cat", header: "Catégorie", render: (s) => supportCategory(s.category) },
    { key: "msg", header: "Message", className: "col-wide", render: (s) => (
      s.message.length > 160
        ? <details className="json"><summary>{truncate(s.message, 160)}</summary><p className="pre-wrap">{s.message}</p></details>
        : <span className="pre-wrap">{s.message}</span>
    ) },
    { key: "user", header: "Client", render: (s) => s.userId ? <Link to={`/clients/${s.userId}`} className="mono">{s.userId.slice(0, 8)}</Link> : <span className="muted">—</span> },
    { key: "job", header: "Job", render: (s) => <IdLink to={`/jobs/${s.jobId ?? ""}`} id={s.jobId} /> },
    { key: "project", header: "Projet", render: (s) => s.projectId ? <span className="mono" title={s.projectId}>{s.projectId.slice(0, 8)}</span> : "—" },
    { key: "version", header: "Version", render: (s) => s.versionId ? <span className="mono" title={s.versionId}>{s.versionId.slice(0, 8)}</span> : "—" },
    { key: "app", header: "App · plateforme", render: (s) => `${s.appVersion ?? "—"} · ${s.platform ?? "—"}` },
    { key: "notes", header: "Notes équipe", render: (s) => s.staffNotes ? <span className="pre-wrap">{truncate(s.staffNotes, 160)}</span> : "—" },
    { key: "act", header: "", className: "nowrap", render: (s) => <Button small onClick={() => setEditing(s)}>Statut / note</Button> },
  ];

  return (
    <>
      <PageHeader title="Support" subtitle="Demandes envoyées depuis l'application, avec le contexte (projet, job, version, plateforme)." />
      {flash ? <Notice tone="success" onDismiss={() => setFlash(null)}>{flash}</Notice> : null}
      <Card>
        <div className="toolbar">
          <SelectField label="Statut" value={values.status} onChange={(e) => setFilter({ status: e.target.value })}>
            <option value="">Tous les statuts</option>
            {SUPPORT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{supportStatus(s).label}</option>)}
          </SelectField>
          <SelectField label="Catégorie" value={values.category} onChange={(e) => setFilter({ category: e.target.value })}>
            <option value="">Toutes</option>
            {SUPPORT_CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{supportCategory(c)}</option>)}
          </SelectField>
        </div>
        <Loadable result={result}>
          {(data) => (
            <>
              <DataTable caption="Demandes de support" columns={columns} rows={data.rows} rowKey={(s) => s.id} emptyTitle="Aucune demande" emptyText="Aucune demande ne correspond à ces filtres." />
              <Pagination page={data.page} hasNext={data.hasNext} onPage={setPage} loading={result.loading} />
            </>
          )}
        </Loadable>
      </Card>
      {editing ? (
        <SupportDialog request={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); setFlash("Demande mise à jour."); result.reload(); }} />
      ) : null}
    </>
  );
}

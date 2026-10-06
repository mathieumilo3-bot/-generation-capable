import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatEuros } from "@app/domain";
import { useBackend } from "../state/backend";
import { useAsync } from "../hooks/useAsync";
import { useUrlState } from "../hooks/useUrlState";
import { listJobs, type JobListRow } from "../data/jobs";
import { Badge, Button, Card, Loadable, PageHeader } from "../components/ui";
import { SelectField } from "../components/Fields";
import { DataTable, Pagination, type Column } from "../components/DataTable";
import { formatDateTime, formatMicroEuros } from "../lib/format";
import { pageRequest } from "../lib/pagination";
import { JOB_STATUS_OPTIONS, jobStatus } from "../lib/status";
import { isUuid } from "../lib/validation";

export function JobsPage() {
  const { db } = useBackend();
  const navigate = useNavigate();
  const { values, page, setFilter, setPage } = useUrlState(["status"] as const);
  const [jobId, setJobId] = useState("");
  const [jobIdError, setJobIdError] = useState<string | undefined>();
  const result = useAsync(() => listJobs(db, values.status, pageRequest(page)), [db, values.status, page]);

  const openById = (e: FormEvent) => {
    e.preventDefault();
    if (!isUuid(jobId)) {
      setJobIdError("Identifiant invalide (UUID attendu).");
      return;
    }
    navigate(`/jobs/${jobId.trim().toLowerCase()}`);
  };

  const columns: Column<JobListRow>[] = [
    { key: "date", header: "Créé le", render: (j) => formatDateTime(j.createdAt) },
    { key: "id", header: "Job", render: (j) => <Link to={`/jobs/${j.id}`} className="mono">{j.id.slice(0, 8)}</Link> },
    { key: "client", header: "Client", render: (j) => <Link to={`/clients/${j.userId}`}>{j.email ?? j.userId.slice(0, 8)}</Link> },
    { key: "status", header: "Statut", render: (j) => { const s = jobStatus(j.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
    { key: "stage", header: "Étape", render: (j) => j.currentStage ? `${j.currentStage} · ${j.progress} %` : `${j.progress} %` },
    { key: "price", header: "Prix", align: "right", render: (j) => formatEuros(j.priceCents) },
    { key: "cost", header: "Coût moteur", align: "right", render: (j) => j.costMicro === null ? "—" : formatMicroEuros(j.costMicro) },
    { key: "margin", header: "Marge", align: "right", render: (j) => j.marginCents === null ? "—" : formatEuros(j.marginCents) },
    { key: "attempts", header: "Essais", align: "right", render: (j) => j.attemptCount },
    { key: "error", header: "Erreur", render: (j) => j.errorCode ? <code className="code">{j.errorCode}</code> : "—" },
  ];

  return (
    <>
      <PageHeader title="Jobs vidéo" subtitle="Coût moteur et marge sont renseignés une fois le job terminé." />
      <Card>
        <div className="toolbar">
          <SelectField label="Statut" value={values.status} onChange={(e) => setFilter({ status: e.target.value })}>
            <option value="">Tous les statuts</option>
            {JOB_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{jobStatus(s).label}</option>)}
          </SelectField>
          <form className="toolbar__form" onSubmit={openById}>
            <div className={`field field--inline${jobIdError ? " field--error" : ""}`}>
              <label htmlFor="job-id" className="field__label">Ouvrir un job par identifiant</label>
              <input id="job-id" value={jobId} onChange={(e) => { setJobId(e.target.value); setJobIdError(undefined); }} placeholder="UUID du job" aria-invalid={jobIdError ? true : undefined} autoComplete="off" spellCheck={false} />
              {jobIdError ? <div className="field__error" role="alert">{jobIdError}</div> : null}
            </div>
            <Button type="submit">Ouvrir</Button>
          </form>
        </div>
        <Loadable result={result}>
          {(data) => (
            <>
              <DataTable
                caption="Liste des jobs vidéo"
                columns={columns}
                rows={data.rows}
                rowKey={(j) => j.id}
                onRowClick={(j) => navigate(`/jobs/${j.id}`)}
                rowClassName={(j) => j.status === "failed" ? "row--danger" : undefined}
                emptyTitle="Aucun job"
                emptyText={values.status ? "Aucun job n'a ce statut." : "Aucune vidéo n'a encore été commandée."}
              />
              <Pagination page={data.page} hasNext={data.hasNext} onPage={setPage} loading={result.loading} />
            </>
          )}
        </Loadable>
      </Card>
    </>
  );
}

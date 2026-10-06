import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useBackend } from "../state/backend";
import { useAsync } from "../hooks/useAsync";
import { useUrlState } from "../hooks/useUrlState";
import { listAuditLogs, type AuditRow } from "../data/audit";
import { Badge, Button, Card, JsonView, Loadable, PageHeader } from "../components/ui";
import { SelectField } from "../components/Fields";
import { DataTable, Pagination, type Column } from "../components/DataTable";
import { formatDateTime, truncate } from "../lib/format";
import { pageRequest } from "../lib/pagination";
import { AUDIT_ENTITIES, auditEntityLabel } from "../lib/status";
import { isUuid } from "../lib/validation";

function EntityLink({ row }: { row: AuditRow }) {
  const label = auditEntityLabel(row.entity);
  if (row.entityId && row.entity === "user") return <>{label} · <Link to={`/clients/${row.entityId}`} className="mono">{row.entityId.slice(0, 8)}</Link></>;
  if (row.entityId && row.entity === "video_job") return <>{label} · <Link to={`/jobs/${row.entityId}`} className="mono">{row.entityId.slice(0, 8)}</Link></>;
  return <>{label}{row.entityId ? <> · <span className="mono" title={row.entityId}>{truncate(row.entityId, 16)}</span></> : null}</>;
}

export function AuditPage() {
  const { db } = useBackend();
  const { values, page, setFilter, setPage } = useUrlState(["entity", "actor", "action", "entityId"] as const);
  const [actor, setActor] = useState(values.actor);
  const [action, setAction] = useState(values.action);
  const [entityId, setEntityId] = useState(values.entityId);
  const [actorError, setActorError] = useState<string | undefined>();

  const result = useAsync(
    () => listAuditLogs(db, { entity: values.entity, actorId: values.actor, action: values.action, entityId: values.entityId }, pageRequest(page)),
    [db, values.entity, values.actor, values.action, values.entityId, page],
  );

  const apply = (e: FormEvent) => {
    e.preventDefault();
    if (actor.trim() !== "" && !isUuid(actor)) {
      setActorError("Identifiant d'acteur invalide (UUID attendu).");
      return;
    }
    setActorError(undefined);
    setFilter({ actor: actor.trim().toLowerCase(), action: action.trim(), entityId: entityId.trim() });
  };

  const reset = () => {
    setActor(""); setAction(""); setEntityId(""); setActorError(undefined);
    setFilter({ entity: "", actor: "", action: "", entityId: "" });
  };

  const columns: Column<AuditRow>[] = [
    { key: "date", header: "Date", render: (r) => formatDateTime(r.createdAt) },
    { key: "actor", header: "Acteur", render: (r) => r.actorId
      ? <><Badge tone={r.actorRole === "admin" ? "success" : "neutral"}>{r.actorRole ?? "?"}</Badge> <Link to={`/clients/${r.actorId}`} className="mono" title={r.actorId}>{r.actorId.slice(0, 8)}</Link></>
      : <span className="muted">Système</span> },
    { key: "action", header: "Action", render: (r) => <code className="code">{r.action}</code> },
    { key: "entity", header: "Entité", render: (r) => <EntityLink row={r} /> },
    { key: "reason", header: "Motif", render: (r) => r.reason ?? "—" },
    { key: "before", header: "Avant", render: (r) => <JsonView value={r.beforeData} summary="Voir" /> },
    { key: "after", header: "Après", render: (r) => <JsonView value={r.afterData} summary="Voir" /> },
  ];

  return (
    <>
      <PageHeader title="Journal d'audit" subtitle="Append-only : aucune entrée ne peut être modifiée ni supprimée. Tri : plus récent d'abord." />
      <Card>
        <form className="toolbar" onSubmit={apply}>
          <SelectField label="Entité" value={values.entity} onChange={(e) => setFilter({ entity: e.target.value })}>
            <option value="">Toutes</option>
            {AUDIT_ENTITIES.map((en) => <option key={en.value} value={en.value}>{en.label}</option>)}
          </SelectField>
          <div className="field field--inline">
            <label htmlFor="audit-action" className="field__label">Action contient</label>
            <input id="audit-action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="ex. wallet." autoComplete="off" />
          </div>
          <div className={`field field--inline${actorError ? " field--error" : ""}`}>
            <label htmlFor="audit-actor" className="field__label">Acteur (UUID)</label>
            <input id="audit-actor" value={actor} onChange={(e) => setActor(e.target.value)} placeholder="identifiant de l'acteur" autoComplete="off" spellCheck={false} aria-invalid={actorError ? true : undefined} />
            {actorError ? <div className="field__error" role="alert">{actorError}</div> : null}
          </div>
          <div className="field field--inline">
            <label htmlFor="audit-entity-id" className="field__label">Identifiant d'entité</label>
            <input id="audit-entity-id" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="UUID ou clé" autoComplete="off" spellCheck={false} />
          </div>
          <Button type="submit" variant="primary">Filtrer</Button>
          <Button onClick={reset}>Réinitialiser</Button>
        </form>
        <Loadable result={result}>
          {(data) => (
            <>
              <DataTable caption="Journal d'audit" columns={columns} rows={data.rows} rowKey={(r) => String(r.id)} emptyTitle="Aucune entrée" emptyText="Aucune entrée ne correspond à ces filtres." />
              <Pagination page={data.page} hasNext={data.hasNext} onPage={setPage} loading={result.loading} />
            </>
          )}
        </Loadable>
      </Card>
    </>
  );
}

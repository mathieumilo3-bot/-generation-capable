import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatEuros } from "@app/domain";
import { useBackend } from "../state/backend";
import { useAsync } from "../hooks/useAsync";
import { useDebounced } from "../hooks/useDebounced";
import { useUrlState } from "../hooks/useUrlState";
import { listCustomers, type CustomerRow } from "../data/customers";
import { Badge, Card, Loadable, PageHeader } from "../components/ui";
import { DataTable, Pagination, type Column } from "../components/DataTable";
import { formatInt, formatRelative } from "../lib/format";
import { pageRequest } from "../lib/pagination";
import { customerStatus } from "../lib/status";

export function CustomersPage() {
  const { db } = useBackend();
  const navigate = useNavigate();
  const { values, page, setFilter, setPage } = useUrlState(["q"] as const);
  const [input, setInput] = useState(values.q);
  const debounced = useDebounced(input, 350);

  useEffect(() => { setInput(values.q); }, [values.q]);
  useEffect(() => {
    if (debounced !== values.q) setFilter({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const result = useAsync(() => listCustomers(db, values.q, pageRequest(page)), [db, values.q, page]);

  const columns: Column<CustomerRow>[] = [
    { key: "name", header: "Nom", render: (c) => <Link to={`/clients/${c.id}`}>{c.name || <span className="muted">Sans nom</span>}</Link> },
    { key: "email", header: "E-mail", render: (c) => c.email ?? "—" },
    { key: "company", header: "Entreprise", render: (c) => c.company ?? "—" },
    { key: "balance", header: "Solde", align: "right", render: (c) => formatEuros(c.availableCents) },
    { key: "spent", header: "Dépenses", align: "right", render: (c) => formatEuros(c.spentCents) },
    { key: "videos", header: "Vidéos", align: "right", render: (c) => formatInt(c.videoCount) },
    { key: "activity", header: "Dernière activité", render: (c) => formatRelative(c.lastActivity) },
    { key: "status", header: "Statut", render: (c) => { const s = customerStatus(c.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
  ];

  return (
    <>
      <PageHeader title="Clients" subtitle="Solde = montant disponible (hors réservations en cours). Dépenses = total encaissé sur les vidéos." />
      <Card>
        <div className="toolbar">
          <div className="field field--inline">
            <label htmlFor="cust-search" className="field__label">Recherche</label>
            <input
              id="cust-search"
              type="search"
              placeholder="Nom, e-mail ou entreprise"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <Loadable result={result}>
          {(data) => (
            <>
              <DataTable
                caption="Liste des clients"
                columns={columns}
                rows={data.rows}
                rowKey={(c) => c.id}
                onRowClick={(c) => navigate(`/clients/${c.id}`)}
                emptyTitle={values.q ? "Aucun client ne correspond à cette recherche" : "Aucun client pour le moment"}
                emptyText={values.q ? "Vérifiez l'orthographe ou essayez une partie de l'e-mail." : "Les clients apparaissent ici dès leur inscription ou l'acceptation d'une invitation."}
              />
              <Pagination page={data.page} hasNext={data.hasNext} onPage={setPage} loading={result.loading} />
            </>
          )}
        </Loadable>
      </Card>
    </>
  );
}

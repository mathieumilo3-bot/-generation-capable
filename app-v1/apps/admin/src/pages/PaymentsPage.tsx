import { Link } from "react-router-dom";
import { formatEuros } from "@app/domain";
import { useBackend } from "../state/backend";
import { useAsync } from "../hooks/useAsync";
import { useUrlState } from "../hooks/useUrlState";
import { listPayments, listWebhooks, type PaymentRow, type WebhookRow } from "../data/payments";
import { Badge, Card, JsonView, Loadable, PageHeader, TabPanel, Tabs } from "../components/ui";
import { SelectField } from "../components/Fields";
import { DataTable, Pagination, type Column } from "../components/DataTable";
import { formatDateTime, truncate } from "../lib/format";
import { pageRequest } from "../lib/pagination";
import { PAYMENT_STATUS_OPTIONS, paymentStatus, WEBHOOK_STATUS_OPTIONS, webhookStatus } from "../lib/status";

type TabId = "payments" | "webhooks";

function PaymentsTab() {
  const { db } = useBackend();
  const { values, page, setFilter, setPage } = useUrlState(["status"] as const);
  const result = useAsync(() => listPayments(db, values.status, pageRequest(page)), [db, values.status, page]);
  const columns: Column<PaymentRow>[] = [
    { key: "date", header: "Date", render: (p) => formatDateTime(p.createdAt) },
    { key: "user", header: "Client", render: (p) => p.userId ? <Link to={`/clients/${p.userId}`} className="mono">{p.userId.slice(0, 8)}</Link> : <span className="muted">Anonymisé</span> },
    { key: "provider", header: "Fournisseur", render: (p) => p.provider },
    { key: "kind", header: "Type", render: (p) => p.kind === "auto_reload" ? "Recharge auto" : "Recharge" },
    { key: "amount", header: "Montant", align: "right", render: (p) => formatEuros(p.amountCents) },
    { key: "refunded", header: "Remboursé", align: "right", render: (p) => p.refundedCents > 0 ? formatEuros(p.refundedCents) : "—" },
    { key: "status", header: "Statut", render: (p) => { const s = paymentStatus(p.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
    { key: "failure", header: "Échec", render: (p) => p.failureCode ? <><code className="code">{p.failureCode}</code>{p.failureDetail ? <div className="muted small">{truncate(p.failureDetail, 100)}</div> : null}</> : "—" },
    { key: "ref", header: "Réf. fournisseur", render: (p) => p.providerRef ? <span className="mono" title={p.providerRef}>{truncate(p.providerRef, 18)}</span> : "—" },
    { key: "platform", header: "Plateforme", render: (p) => p.platform ?? "—" },
  ];
  return (
    <>
      <div className="toolbar">
        <SelectField label="Statut" value={values.status} onChange={(e) => setFilter({ status: e.target.value })}>
          <option value="">Tous les statuts</option>
          {PAYMENT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{paymentStatus(s).label}</option>)}
        </SelectField>
      </div>
      <Loadable result={result}>
        {(data) => (
          <>
            <DataTable caption="Paiements" columns={columns} rows={data.rows} rowKey={(p) => p.id} rowClassName={(p) => p.status === "failed" ? "row--danger" : undefined} emptyTitle="Aucun paiement" emptyText="Aucun paiement ne correspond à ce filtre." />
            <Pagination page={data.page} hasNext={data.hasNext} onPage={setPage} loading={result.loading} />
          </>
        )}
      </Loadable>
    </>
  );
}

function WebhooksTab() {
  const { db } = useBackend();
  const { values, page, setFilter, setPage } = useUrlState(["status", "provider"] as const);
  const result = useAsync(() => listWebhooks(db, { status: values.status, provider: values.provider }, pageRequest(page)), [db, values.status, values.provider, page]);
  const columns: Column<WebhookRow>[] = [
    { key: "date", header: "Reçu le", render: (w) => formatDateTime(w.receivedAt) },
    { key: "provider", header: "Fournisseur", render: (w) => w.provider },
    { key: "type", header: "Type d'événement", render: (w) => <code className="code">{w.eventType}</code> },
    { key: "event", header: "Événement", render: (w) => <span className="mono" title={w.eventId}>{truncate(w.eventId, 18)}</span> },
    { key: "status", header: "Statut", render: (w) => { const s = webhookStatus(w.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
    { key: "attempts", header: "Tentatives", align: "right", render: (w) => w.attempts },
    { key: "error", header: "Erreur", render: (w) => w.error ? <span className="neg">{truncate(w.error, 140)}</span> : "—" },
    { key: "processed", header: "Traité le", render: (w) => formatDateTime(w.processedAt) },
    { key: "payload", header: "Charge", render: (w) => <JsonView value={w.payload} summary="Voir" /> },
  ];
  return (
    <>
      <div className="toolbar">
        <SelectField label="Statut" value={values.status} onChange={(e) => setFilter({ status: e.target.value })}>
          <option value="">Tous les statuts</option>
          {WEBHOOK_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{webhookStatus(s).label}</option>)}
        </SelectField>
        <SelectField label="Fournisseur" value={values.provider} onChange={(e) => setFilter({ provider: e.target.value })}>
          <option value="">Tous</option>
          <option value="stripe">Stripe</option>
          <option value="apple">Apple</option>
          <option value="google">Google</option>
        </SelectField>
      </div>
      <Loadable result={result}>
        {(data) => (
          <>
            <DataTable caption="Événements webhook" columns={columns} rows={data.rows} rowKey={(w) => w.id} rowClassName={(w) => w.status === "failed" ? "row--danger" : undefined} emptyTitle="Aucun webhook" emptyText="Aucun événement ne correspond à ces filtres." />
            <Pagination page={data.page} hasNext={data.hasNext} onPage={setPage} loading={result.loading} />
          </>
        )}
      </Loadable>
    </>
  );
}

export function PaymentsPage() {
  const { values, setFilter } = useUrlState(["tab", "status", "provider"] as const);
  const tab: TabId = values.tab === "webhooks" ? "webhooks" : "payments";
  return (
    <>
      <PageHeader title="Paiements et webhooks" subtitle="Lecture seule. Les remboursements de paiement se font chez le fournisseur ; les montants rendus au client passent par son solde." />
      <Card>
        <Tabs<TabId>
          label="Paiements ou webhooks"
          value={tab}
          onChange={(t) => setFilter({ tab: t === "webhooks" ? "webhooks" : "", status: "", provider: "" })}
          tabs={[{ id: "payments", label: "Paiements" }, { id: "webhooks", label: "Webhooks" }]}
        />
        <TabPanel id="payments" active={tab === "payments"}><PaymentsTab /></TabPanel>
        <TabPanel id="webhooks" active={tab === "webhooks"}><WebhooksTab /></TabPanel>
      </Card>
    </>
  );
}

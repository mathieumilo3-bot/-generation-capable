import { Link } from "react-router-dom";
import { formatEuros, microToCentsCeil } from "@app/domain";
import { useBackend } from "../state/backend";
import { useAsync } from "../hooks/useAsync";
import { fetchDashboard } from "../data/dashboard";
import { listJobs } from "../data/jobs";
import { countOpenSupportRequests } from "../data/support";
import { countFailedWebhooks } from "../data/payments";
import { Card, EmptyState, ErrorState, Loadable, PageHeader, Spinner, Stat, Badge } from "../components/ui";
import { BarList, StackedBar } from "../components/Charts";
import { formatDateTime, formatInt, formatMicroEuros } from "../lib/format";
import { pageRequest } from "../lib/pagination";
import { successRate } from "../lib/charts";

function Attention() {
  const { db } = useBackend();
  const failed = useAsync(() => listJobs(db, "failed", pageRequest(0, 5)), [db]);
  const support = useAsync(() => countOpenSupportRequests(db), [db]);
  const webhooks = useAsync(() => countFailedWebhooks(db), [db]);

  return (
    <Card title="À traiter">
      <ul className="todo">
        <li>
          <span>Demandes de support ouvertes</span>
          {support.error ? <Badge tone="neutral">indisponible</Badge> : support.data === null ? <span className="muted">…</span> : (
            <Link to="/support?status=open"><strong className="num">{support.data}</strong></Link>
          )}
        </li>
        <li>
          <span>Webhooks en échec</span>
          {webhooks.error ? <Badge tone="neutral">indisponible</Badge> : webhooks.data === null ? <span className="muted">…</span> : (
            <Link to="/paiements?tab=webhooks&status=failed"><strong className="num">{webhooks.data}</strong></Link>
          )}
        </li>
      </ul>
      <h3 className="subtitle">Derniers jobs en échec</h3>
      {failed.error && failed.data === null ? <ErrorState error={failed.error} onRetry={failed.reload} /> : failed.data === null ? <Spinner /> : failed.data.rows.length === 0 ? (
        <p className="muted">Aucun job en échec.</p>
      ) : (
        <ul className="todo">
          {failed.data.rows.map((j) => (
            <li key={j.id}>
              <span>
                <Link to={`/jobs/${j.id}`} className="mono">{j.id.slice(0, 8)}</Link>{" "}
                <span className="muted">{j.email ?? "—"}</span>
              </span>
              <span className="muted small">{formatDateTime(j.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const { db } = useBackend();
  const dash = useAsync(() => fetchDashboard(db), [db]);

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Indicateurs du mois en cours (fuseau Europe/Paris). Le CA correspond aux montants encaissés sur les vidéos (consommés)." />
      <Loadable result={dash}>
        {(d) => {
          const rate = successRate(d.jobsCompletedMonth, d.jobsFailedMonth);
          const engineCents = microToCentsCeil(d.engineCostMonthMicro);
          const hasActivity = d.videosMonth > 0 || d.revenueMonthCents > 0 || d.walletRechargedMonthCents > 0;
          return (
            <>
              <section aria-label="Chiffre d'affaires" className="grid grid--kpi">
                <Stat label="CA aujourd'hui" value={formatEuros(d.revenueTodayCents)} />
                <Stat label="CA ce mois" value={formatEuros(d.revenueMonthCents)} />
                <Stat label="Rechargé ce mois" value={formatEuros(d.walletRechargedMonthCents)} hint="Trésorerie entrante" />
                <Stat label="Consommé ce mois" value={formatEuros(d.walletConsumedMonthCents)} />
                <Stat label="Remboursé ce mois" value={formatEuros(d.refundedMonthCents)} />
                <Stat label="Solde en circulation" value={formatEuros(d.outstandingWalletCents)} hint="Somme des portefeuilles non clos" />
              </section>

              <section aria-label="Production et rentabilité" className="grid grid--kpi">
                <Stat label="Vidéos ce mois" value={formatInt(d.videosMonth)} />
                <Stat label="Jobs réussis" value={formatInt(d.jobsCompletedMonth)} tone="success" hint={rate === null ? undefined : `Taux de réussite ${rate} %`} />
                <Stat label="Jobs échoués" value={formatInt(d.jobsFailedMonth)} tone={d.jobsFailedMonth > 0 ? "danger" : undefined} />
                <Stat label="Jobs actifs" value={formatInt(d.jobsActive)} hint="En cours maintenant" />
                <Stat label="Coût moteur réel" value={formatMicroEuros(d.engineCostMonthMicro)} hint="Converti depuis les µ€" />
                <Stat label="Marge brute estimée" value={formatEuros(d.grossMarginMonthCents)} hint="Jobs terminés du mois" tone={d.grossMarginMonthCents < 0 ? "danger" : undefined} />
              </section>

              {!hasActivity ? (
                <Card><EmptyState title="Aucune activité ce mois-ci">Les graphiques apparaîtront dès la première recharge ou la première vidéo.</EmptyState></Card>
              ) : (
                <div className="grid grid--2">
                  <Card title="Flux financiers du mois">
                    <BarList
                      ariaLabel="Flux financiers du mois en euros"
                      items={[
                        { key: "topup", label: "Rechargé", value: d.walletRechargedMonthCents, display: formatEuros(d.walletRechargedMonthCents) },
                        { key: "capture", label: "Consommé (CA)", value: d.walletConsumedMonthCents, display: formatEuros(d.walletConsumedMonthCents), tone: "success" },
                        { key: "refund", label: "Remboursé", value: d.refundedMonthCents, display: formatEuros(d.refundedMonthCents), tone: "warning" },
                        { key: "engine", label: "Coût moteur", value: engineCents, display: formatMicroEuros(d.engineCostMonthMicro), tone: "muted" },
                        { key: "margin", label: "Marge brute", value: Math.max(d.grossMarginMonthCents, 0), display: formatEuros(d.grossMarginMonthCents), tone: "success" },
                      ]}
                    />
                  </Card>
                  <Card title="Jobs du mois">
                    <StackedBar
                      ariaLabel="Répartition des jobs : réussis, échoués, actifs"
                      emptyLabel="Aucun job ce mois-ci."
                      items={[
                        { key: "ok", label: "Réussis", value: d.jobsCompletedMonth, tone: "success" },
                        { key: "ko", label: "Échoués", value: d.jobsFailedMonth, tone: "danger" },
                        { key: "active", label: "Actifs", value: d.jobsActive, tone: "info" },
                      ]}
                    />
                    <p className="muted small">
                      {formatInt(d.customersTotal)} clients au total. Les « actifs » comptent tous les jobs en cours, quel que soit leur mois de création.
                    </p>
                  </Card>
                </div>
              )}
            </>
          );
        }}
      </Loadable>
      <Attention />
      <p className="muted small">Voir aussi : <Link to="/jobs?status=failed">tous les jobs en échec</Link> · <Link to="/jobs">tous les jobs</Link>.</p>
    </>
  );
}

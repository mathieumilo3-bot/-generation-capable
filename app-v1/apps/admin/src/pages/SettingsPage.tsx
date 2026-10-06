import { useMemo, useState } from "react";
import { formatEuros } from "@app/domain";
import { useBackend } from "../state/backend";
import { useStaff } from "../state/auth";
import { useAsync } from "../hooks/useAsync";
import {
  changePrice, listEngineCapabilities, listPricingRules, listSettings, setSetting,
  type AppSetting, type EngineCapabilitiesRow, type PricingRule,
} from "../data/config";
import { Badge, Button, Card, EmptyState, JsonView, Loadable, Notice, PageHeader, ReadOnlyHint, TabPanel, Tabs } from "../components/ui";
import { TextArea, TextField, ReasonField } from "../components/Fields";
import { DataTable, type Column } from "../components/DataTable";
import { ActionDialog } from "../components/Dialog";
import { formatDate, formatDateTime, prettyJson, truncate } from "../lib/format";
import { formatDurationRange, isCurrentRule, modeLabel } from "../lib/pricing";
import { centsHint, validateSettingValue } from "../lib/settings";
import { validatePriceChange, validateReason } from "../lib/validation";

type TabId = "prices" | "settings" | "engine";

// ── Tarifs ──────────────────────────────────────────────────────────────
function PriceDialog({ rule, onClose, onDone }: { rule: PricingRule; onClose: () => void; onDone: (m: string) => void }) {
  const { db } = useBackend();
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ price?: string; reason?: string }>({});
  const check = validatePriceChange(rule.priceCents, price);

  return (
    <ActionDialog
      title={`Changer le prix : ${modeLabel(rule.mode)} · ${rule.label}`}
      description="L'ancienne règle est close (historique conservé) et une nouvelle prend le relais immédiatement. Les jobs déjà commandés gardent leur prix."
      onClose={onClose}
      form={(
        <>
          <TextField
            label="Nouveau prix (en euros)"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={errors.price}
            hint={`Prix actuel : ${formatEuros(rule.priceCents)}`}
            autoComplete="off"
            required
          />
          <ReasonField value={reason} onChange={setReason} error={errors.reason} />
        </>
      )}
      validate={() => {
        const next: { price?: string; reason?: string } = {};
        if (!check.ok) next.price = check.error;
        const r = validateReason(reason);
        if (r) next.reason = r;
        setErrors(next);
        return Object.keys(next).length === 0;
      }}
      summary={check.ok ? (
        <>
          <p className="confirm__amount">{formatEuros(rule.priceCents)} → {formatEuros(check.cents)}</p>
          <p>Prix de « {rule.label} » ({modeLabel(rule.mode)}, {formatDurationRange(rule.durationMinSec, rule.durationMaxSec)}).</p>
          {check.warning ? <Notice tone="warning">{check.warning}</Notice> : null}
          <p className="muted">Motif : {reason.trim()}</p>
        </>
      ) : <Notice tone="error">Prix invalide.</Notice>}
      confirmLabel={check.ok ? `Appliquer ${formatEuros(check.cents)}` : "Appliquer"}
      onConfirm={async () => {
        if (!check.ok) throw new Error(check.error);
        await changePrice(db, rule.id, check.cents, reason);
      }}
      onDone={() => onDone(check.ok ? `Nouveau prix enregistré : ${formatEuros(check.cents)}.` : "Prix enregistré.")}
    />
  );
}

function PricesTab({ canWrite }: { canWrite: boolean }) {
  const { db } = useBackend();
  const result = useAsync(() => listPricingRules(db), [db]);
  const [history, setHistory] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const now = new Date();

  const columns: Column<PricingRule>[] = [
    { key: "mode", header: "Mode", render: (r) => modeLabel(r.mode) },
    { key: "label", header: "Tranche", render: (r) => <>{r.label}<div className="muted small">{formatDurationRange(r.durationMinSec, r.durationMaxSec)}</div></> },
    { key: "price", header: "Prix", align: "right", render: (r) => <strong>{formatEuros(r.priceCents)}</strong> },
    { key: "from", header: "En vigueur depuis", render: (r) => formatDateTime(r.effectiveFrom) },
    { key: "to", header: "Jusqu'au", render: (r) => r.effectiveTo ? formatDateTime(r.effectiveTo) : "—" },
    { key: "state", header: "État", render: (r) => isCurrentRule(r, now) ? <Badge tone="success">En vigueur</Badge> : <Badge tone="neutral">{r.active ? "Planifiée" : "Historique"}</Badge> },
    { key: "act", header: "", render: (r) => canWrite && isCurrentRule(r, now) ? <Button small onClick={() => setEditing(r)}>Changer le prix</Button> : null },
  ];

  return (
    <Loadable result={result}>
      {(rules) => {
        const shown = history ? rules : rules.filter((r) => isCurrentRule(r, now));
        return (
          <>
            {flash ? <Notice tone="success" onDismiss={() => setFlash(null)}>{flash}</Notice> : null}
            <div className="toolbar">
              <label className="check">
                <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />
                Afficher l'historique des prix
              </label>
            </div>
            <DataTable caption="Règles tarifaires" columns={columns} rows={shown} rowKey={(r) => r.id} emptyTitle="Aucune règle tarifaire en vigueur" rowClassName={(r) => isCurrentRule(r, now) ? undefined : "row--muted"} />
            {editing ? (
              <PriceDialog rule={editing} onClose={() => setEditing(null)} onDone={(m) => { setEditing(null); setFlash(m); result.reload(); }} />
            ) : null}
          </>
        );
      }}
    </Loadable>
  );
}

// ── Réglages ────────────────────────────────────────────────────────────
function SettingDialog({ setting, others, onClose, onDone }: {
  setting: AppSetting;
  others: Readonly<Record<string, unknown>>;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const { db } = useBackend();
  const [text, setText] = useState(() => prettyJson(setting.value));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ value?: string; reason?: string }>({});
  const check = validateSettingValue(setting.key, text, { current: setting.value, others });
  const hint = check.ok ? centsHint(setting.key, check.value) : centsHint(setting.key, setting.value);

  return (
    <ActionDialog
      title={`Modifier « ${setting.key} »`}
      description={setting.description ?? undefined}
      onClose={onClose}
      form={(
        <>
          {!setting.isPublic ? <Notice tone="info">Réglage privé : non lisible par l'application cliente.</Notice> : null}
          <TextArea
            label="Valeur (JSON)"
            className="mono"
            rows={8}
            spellCheck={false}
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={errors.value}
            hint={hint ? `Soit : ${hint}` : "Exemples : true · 1000 · \"texte\" · [1000, 2000] · {\"web\": \"1.0.0\"}"}
          />
          <ReasonField value={reason} onChange={setReason} error={errors.reason} />
        </>
      )}
      validate={() => {
        const next: { value?: string; reason?: string } = {};
        if (!check.ok) next.value = check.error;
        const r = validateReason(reason);
        if (r) next.reason = r;
        setErrors(next);
        return Object.keys(next).length === 0;
      }}
      summary={check.ok ? (
        <>
          {check.risk === "high" ? <Notice tone="warning" title="Réglage sensible">Ce changement s'applique immédiatement à tous les utilisateurs.</Notice> : null}
          {check.warnings.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}
          <div className="diff">
            <div><div className="diff__label">Avant</div><pre>{prettyJson(setting.value)}</pre></div>
            <div><div className="diff__label">Après</div><pre>{prettyJson(check.value)}</pre></div>
          </div>
          {hint ? <p className="muted">Soit {hint}.</p> : null}
          <p className="muted">Motif : {reason.trim()}</p>
        </>
      ) : <Notice tone="error">Valeur invalide.</Notice>}
      confirmLabel={check.ok && check.risk === "high" ? "Appliquer ce réglage sensible" : "Appliquer"}
      danger={check.ok && check.risk === "high"}
      onConfirm={async () => {
        if (!check.ok) throw new Error(check.error);
        await setSetting(db, setting.key, check.value, reason);
      }}
      onDone={() => onDone(`Réglage « ${setting.key} » mis à jour.`)}
    />
  );
}

function SettingsTab({ canWrite }: { canWrite: boolean }) {
  const { db } = useBackend();
  const result = useAsync(() => listSettings(db), [db]);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<AppSetting | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const columns: Column<AppSetting>[] = [
    { key: "key", header: "Clé", render: (s) => <code className="code">{s.key}</code> },
    { key: "value", header: "Valeur", render: (s) => {
      const hint = centsHint(s.key, s.value);
      return <><span className="mono">{truncate(JSON.stringify(s.value) ?? "null", 90)}</span>{hint ? <div className="muted small">{hint}</div> : null}</>;
    } },
    { key: "vis", header: "Visibilité", render: (s) => <Badge tone={s.isPublic ? "info" : "neutral"}>{s.isPublic ? "Public" : "Privé"}</Badge> },
    { key: "desc", header: "Description", render: (s) => s.description ?? "—" },
    { key: "upd", header: "Modifié le", render: (s) => formatDate(s.updatedAt) },
    { key: "act", header: "", render: (s) => canWrite ? <Button small onClick={() => setEditing(s)}>Modifier</Button> : null },
  ];

  return (
    <Loadable result={result}>
      {(all) => {
        const q = filter.trim().toLowerCase();
        const rows = q ? all.filter((s) => s.key.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)) : all;
        const others: Record<string, unknown> = Object.fromEntries(all.map((s) => [s.key, s.value]));
        return (
          <>
            {flash ? <Notice tone="success" onDismiss={() => setFlash(null)}>{flash}</Notice> : null}
            <div className="toolbar">
              <div className="field field--inline">
                <label htmlFor="setting-filter" className="field__label">Filtrer les réglages</label>
                <input id="setting-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Clé ou description" autoComplete="off" />
              </div>
            </div>
            <DataTable caption="Réglages de l'application" columns={columns} rows={rows} rowKey={(s) => s.key} emptyTitle="Aucun réglage" />
            {editing ? (
              <SettingDialog setting={editing} others={others} onClose={() => setEditing(null)} onDone={(m) => { setEditing(null); setFlash(m); result.reload(); }} />
            ) : null}
          </>
        );
      }}
    </Loadable>
  );
}

// ── Capacités du moteur ─────────────────────────────────────────────────
function CapabilityValue({ value }: { value: unknown }) {
  if (typeof value === "boolean") return <Badge tone={value ? "success" : "warning"}>{value ? "Oui" : "Non"}</Badge>;
  if (typeof value === "number" || typeof value === "string") return <span>{String(value)}</span>;
  return <JsonView value={value} summary="Détail" />;
}

function EngineTab() {
  const { db } = useBackend();
  const result = useAsync(() => listEngineCapabilities(db), [db]);
  const columns: Column<EngineCapabilitiesRow>[] = [
    { key: "v", header: "Version du moteur", render: (r) => r.engineVersion },
    { key: "active", header: "État", render: (r) => <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Historique"}</Badge> },
    { key: "created", header: "Enregistrée le", render: (r) => formatDateTime(r.createdAt) },
  ];
  return (
    <Loadable result={result}>
      {(rows) => {
        const active = rows.find((r) => r.active);
        return (
          <>
            <p className="muted">Lecture seule : les capacités sont publiées par le moteur et filtrent ce que l'application propose aux clients.</p>
            {active ? (
              <Card title={`Capacités actives — ${active.engineVersion}`}>
                <ul className="caps">
                  {Object.entries(active.capabilities).map(([k, v]) => (
                    <li key={k}><code className="code">{k}</code> <CapabilityValue value={v} /></li>
                  ))}
                </ul>
              </Card>
            ) : <EmptyState title="Aucune capacité active">Le moteur n'a publié aucune ligne active.</EmptyState>}
            <DataTable caption="Versions de capacités du moteur" columns={columns} rows={rows} rowKey={(r) => r.id} emptyTitle="Aucune version" />
          </>
        );
      }}
    </Loadable>
  );
}

export function SettingsPage() {
  const { canWrite, role } = useStaff();
  const [tab, setTab] = useState<TabId>("prices");
  const tabs = useMemo(() => [
    { id: "prices" as const, label: "Tarifs" },
    { id: "settings" as const, label: "Réglages" },
    { id: "engine" as const, label: "Capacités du moteur" },
  ], []);
  return (
    <>
      <PageHeader title="Tarifs et réglages" subtitle="Tout changement est journalisé avec son motif. Les prix passés restent consultables." />
      {!canWrite ? <ReadOnlyHint role={role} /> : null}
      <Card>
        <Tabs<TabId> label="Sections tarifs et réglages" tabs={tabs} value={tab} onChange={setTab} />
        <TabPanel id="prices" active={tab === "prices"}><PricesTab canWrite={canWrite} /></TabPanel>
        <TabPanel id="settings" active={tab === "settings"}><SettingsTab canWrite={canWrite} /></TabPanel>
        <TabPanel id="engine" active={tab === "engine"}><EngineTab /></TabPanel>
      </Card>
    </>
  );
}

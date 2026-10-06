import { useState, type FormEvent } from "react";
import { formatEuros } from "@app/domain";
import { useBackend } from "../state/backend";
import { useStaff } from "../state/auth";
import { useAsync } from "../hooks/useAsync";
import { useUrlState } from "../hooks/useUrlState";
import { createClientInvitation, listInvitations, revokeInvitation, type InvitationRow } from "../data/invitations";
import { Badge, Button, Card, CopyButton, Loadable, Notice, PageHeader, ReadOnlyHint } from "../components/ui";
import { SelectField, TextArea, TextField } from "../components/Fields";
import { DataTable, Pagination, type Column } from "../components/DataTable";
import { ActionDialog } from "../components/Dialog";
import { buildInviteLink, EMPTY_INVITATION_FORM, validateInvitationForm, type InvitationFormErrors, type InvitationFormValues, type InvitationPayload } from "../lib/validation";
import { dealStatus, effectiveInvitationStatus, invitationStatus } from "../lib/status";
import { formatDateTime } from "../lib/format";
import { pageRequest } from "../lib/pagination";

interface CreatedLink { token: string; link: string | null; email: string }

function CreatedPanel({ created, onDismiss }: { created: CreatedLink; onDismiss: () => void }) {
  const value = created.link ?? created.token;
  return (
    <section className="card card--highlight" aria-labelledby="created-title">
      <h2 id="created-title" className="card__title">Lien d'invitation créé pour {created.email}</h2>
      <Notice tone="warning" title="Ce lien ne sera plus jamais affiché">
        Seul son empreinte est conservée sur le serveur. Copiez-le maintenant et transmettez-le au client par un canal sûr.
        Quiconque possède ce lien peut activer le crédit : ne le publiez pas.
      </Notice>
      {created.link === null ? (
        <Notice tone="error" title="URL publique non configurée">
          VITE_PUBLIC_APP_URL est absente ou invalide : voici le jeton brut. Le lien à envoyer est « &lt;URL de l'app&gt;/invite/&lt;jeton&gt; ».
        </Notice>
      ) : null}
      <div className="field">
        <label htmlFor="invite-link" className="field__label">{created.link ? "Lien d'invitation" : "Jeton d'invitation"}</label>
        <input id="invite-link" className="mono" readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <div className="row-actions">
        <CopyButton text={value} label={created.link ? "Copier le lien" : "Copier le jeton"} />
        <Button variant="primary" onClick={onDismiss}>J'ai copié le lien, fermer</Button>
      </div>
    </section>
  );
}

export function SalesPage() {
  const { db, env } = useBackend();
  const { canWrite, role } = useStaff();
  const { page, setPage } = useUrlState([] as const);
  const list = useAsync(() => listInvitations(db, pageRequest(page)), [db, page]);

  const [values, setValues] = useState<InvitationFormValues>(EMPTY_INVITATION_FORM);
  const [errors, setErrors] = useState<InvitationFormErrors>({});
  const [pending, setPending] = useState<{ payload: InvitationPayload; total: number } | null>(null);
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [revoking, setRevoking] = useState<InvitationRow | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const set = (k: keyof InvitationFormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = validateInvitationForm(values);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setPending({ payload: res.payload, total: res.totalCreditCents });
  };

  const columns: Column<InvitationRow>[] = [
    { key: "date", header: "Créée le", render: (i) => formatDateTime(i.createdAt) },
    { key: "client", header: "Client", render: (i) => <>{i.deal?.clientName ?? "—"}<div className="muted small">{i.email ?? "—"}</div></> },
    { key: "company", header: "Entreprise", render: (i) => i.deal?.company ?? "—" },
    { key: "source", header: "Source · campagne · commercial", render: (i) => [i.deal?.source, i.deal?.campaign, i.deal?.salesperson].filter(Boolean).join(" · ") || "—" },
    { key: "ref", header: "Deal", className: "nowrap", render: (i) => i.deal?.ref ?? "—" },
    { key: "paid", header: "Payé", align: "right", render: (i) => i.deal ? formatEuros(i.deal.paidCents) : "—" },
    { key: "gift", header: "Offert", align: "right", render: (i) => i.deal ? formatEuros(i.deal.giftedCents) : "—" },
    { key: "credit", header: "Crédit initial", align: "right", render: (i) => formatEuros(i.creditCents) },
    { key: "deal-status", header: "Deal", render: (i) => { if (!i.deal) return "—"; const s = dealStatus(i.deal.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
    { key: "status", header: "Invitation", render: (i) => { const s = invitationStatus(effectiveInvitationStatus(i.status, i.expiresAt)); return <Badge tone={s.tone}>{s.label}</Badge>; } },
    { key: "exp", header: "Expire le", className: "nowrap", render: (i) => formatDateTime(i.expiresAt) },
    { key: "act", header: "", className: "nowrap", render: (i) => canWrite && effectiveInvitationStatus(i.status, i.expiresAt) === "pending"
      ? <Button small variant="danger" onClick={() => setRevoking(i)}>Révoquer</Button> : null },
  ];

  return (
    <>
      <PageHeader title="Nouveau client · Ventes directes" subtitle="Crée un deal commercial et un lien d'invitation personnel. Le crédit initial = montant payé + solde offert." />
      {flash ? <Notice tone="success" onDismiss={() => setFlash(null)}>{flash}</Notice> : null}
      {created ? <CreatedPanel created={created} onDismiss={() => setCreated(null)} /> : null}

      {canWrite ? (
        <Card title="Créer un client">
          <form onSubmit={submit} noValidate className="form-grid">
            <TextField label="Nom du client *" value={values.clientName} onChange={set("clientName")} error={errors.clientName} autoComplete="off" required />
            <TextField label="E-mail *" type="email" value={values.email} onChange={set("email")} error={errors.email} autoComplete="off" required />
            <TextField label="Entreprise" value={values.company} onChange={set("company")} error={errors.company} autoComplete="off" />
            <TextField label="Source" value={values.source} onChange={set("source")} error={errors.source} hint="ex. salon, partenaire, LinkedIn" autoComplete="off" />
            <TextField label="Campagne" value={values.campaign} onChange={set("campaign")} error={errors.campaign} autoComplete="off" />
            <TextField label="Commercial" value={values.salesperson} onChange={set("salesperson")} error={errors.salesperson} autoComplete="off" />
            <TextField label="Deal ID" value={values.dealRef} onChange={set("dealRef")} error={errors.dealRef} hint="Optionnel, unique (CRM / facture)." autoComplete="off" />
            <TextField label="Montant payé (€)" inputMode="decimal" value={values.paid} onChange={set("paid")} error={errors.paid} hint="Encaissé hors application." autoComplete="off" />
            <TextField label="Solde offert (€)" inputMode="decimal" value={values.gifted} onChange={set("gifted")} error={errors.gifted} hint="Geste commercial, hors encaissement." autoComplete="off" />
            <SelectField label="Expiration du lien" value={values.expiresDays} onChange={set("expiresDays")} error={errors.expiresDays}>
              {["3", "7", "14", "30", "60", "90"].map((d) => <option key={d} value={d}>{d} jours</option>)}
            </SelectField>
            <div className="form-grid__wide">
              <TextArea label="Notes internes" rows={3} value={values.notes} onChange={set("notes")} error={errors.notes} />
            </div>
            <div className="form-grid__wide row-actions">
              <Button type="submit" variant="primary">Créer le client et le lien</Button>
              <Button onClick={() => { setValues(EMPTY_INVITATION_FORM); setErrors({}); }}>Réinitialiser</Button>
            </div>
          </form>
        </Card>
      ) : <ReadOnlyHint role={role} />}

      <Card title="Invitations et deals">
        <Loadable result={list}>
          {(data) => (
            <>
              <DataTable caption="Invitations et deals commerciaux" columns={columns} rows={data.rows} rowKey={(i) => i.id} emptyTitle="Aucune invitation" emptyText="Créez un premier client pour générer un lien d'invitation." />
              <Pagination page={data.page} hasNext={data.hasNext} onPage={setPage} loading={list.loading} />
            </>
          )}
        </Loadable>
      </Card>

      {pending ? (
        <ActionDialog
          title="Confirmer la création"
          onClose={() => setPending(null)}
          summary={(
            <>
              <p className="confirm__amount">{formatEuros(pending.total)}</p>
              <p>
                Crédit initial offert à <strong>{pending.payload.clientName}</strong> ({pending.payload.email}) :
                {" "}{formatEuros(pending.payload.paidCents)} payés + {formatEuros(pending.payload.giftedCents)} offerts.
              </p>
              <p className="muted small">Le crédit est versé au client lorsqu'il accepte l'invitation. Le lien expire dans {pending.payload.expiresDays} jours.</p>
            </>
          )}
          confirmLabel={`Créer avec ${formatEuros(pending.total)} de crédit`}
          onConfirm={async () => {
            const res = await createClientInvitation(db, pending.payload);
            setCreated({ token: res.token, link: buildInviteLink(env.publicAppUrl, res.token), email: pending.payload.email });
          }}
          onDone={() => {
            setPending(null);
            setValues(EMPTY_INVITATION_FORM);
            list.reload();
          }}
        />
      ) : null}

      {revoking ? (
        <ActionDialog
          title="Révoquer cette invitation"
          onClose={() => setRevoking(null)}
          summary={(
            <>
              <p>Le lien envoyé à <strong>{revoking.email ?? revoking.deal?.clientName ?? "ce client"}</strong> ne fonctionnera plus. Le crédit de {formatEuros(revoking.creditCents)} ne sera pas versé.</p>
            </>
          )}
          confirmLabel="Révoquer l'invitation"
          danger
          onConfirm={() => revokeInvitation(db, revoking.id)}
          onDone={() => { setRevoking(null); setFlash("Invitation révoquée."); list.reload(); }}
        />
      ) : null}
    </>
  );
}

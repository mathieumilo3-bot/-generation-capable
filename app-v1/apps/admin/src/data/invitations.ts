import type { AdminDb } from "./db";
import { asArray, asRecord, mapRows, num, str, strOrNull } from "../lib/decode";
import { AdminError } from "../lib/errors";
import { toPage, type Page, type PageRequest } from "../lib/pagination";
import type { InvitationPayload } from "../lib/validation";

export interface CreatedInvitation {
  dealId: string;
  invitationId: string;
  /** Jeton en clair : retourné UNE seule fois par le serveur (seul son hash est stocké). */
  token: string;
}

export async function createClientInvitation(db: AdminDb, p: InvitationPayload): Promise<CreatedInvitation> {
  const r = asRecord(await db.rpc("admin_create_client_invitation", {
    p_client_name: p.clientName,
    p_email: p.email,
    p_company: p.company,
    p_source_name: p.sourceName,
    p_campaign: p.campaign,
    p_salesperson: p.salesperson,
    p_deal_ref: p.dealRef,
    p_paid_cents: p.paidCents,
    p_gifted_credit_cents: p.giftedCents,
    p_notes: p.notes,
    p_expires_days: p.expiresDays,
  }));
  const token = str(r.token);
  if (r.ok !== true || token === "") throw new AdminError("unknown");
  return { dealId: str(r.deal_id), invitationId: str(r.invitation_id), token };
}

export async function revokeInvitation(db: AdminDb, invitationId: string): Promise<void> {
  await db.rpc("admin_revoke_invitation", { p_invitation_id: invitationId });
}

export interface InvitationRow {
  id: string;
  kind: string;
  email: string | null;
  creditCents: number;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  deal: {
    ref: string | null;
    clientName: string;
    company: string | null;
    paidCents: number;
    giftedCents: number;
    status: string;
    source: string | null;
    campaign: string | null;
    salesperson: string | null;
  } | null;
}

/** Colonnes explicites : `token_hash` n'est jamais demandé. */
export const INVITATION_COLUMNS =
  "id,kind,email,credit_cents,status,expires_at,accepted_at,created_at," +
  "commercial_deals(deal_ref,client_name,company,paid_cents,gifted_credit_cents,status,sales_sources(name,campaign,salesperson))";

function firstRecord(v: unknown): Record<string, unknown> | null {
  const rec = Array.isArray(v) ? asArray(v)[0] : v;
  const r = asRecord(rec);
  return Object.keys(r).length > 0 ? r : null;
}

export function decodeInvitationRow(r: Record<string, unknown>): InvitationRow {
  const d = firstRecord(r.commercial_deals);
  const s = d ? firstRecord(d.sales_sources) : null;
  return {
    id: str(r.id),
    kind: str(r.kind, "client"),
    email: strOrNull(r.email),
    creditCents: num(r.credit_cents),
    status: str(r.status, "pending"),
    expiresAt: str(r.expires_at),
    acceptedAt: strOrNull(r.accepted_at),
    createdAt: str(r.created_at),
    deal: d
      ? {
          ref: strOrNull(d.deal_ref), clientName: str(d.client_name), company: strOrNull(d.company),
          paidCents: num(d.paid_cents), giftedCents: num(d.gifted_credit_cents), status: str(d.status, "pending"),
          source: s ? strOrNull(s.name) : null, campaign: s ? strOrNull(s.campaign) : null,
          salesperson: s ? strOrNull(s.salesperson) : null,
        }
      : null,
  };
}

export async function listInvitations(db: AdminDb, req: PageRequest): Promise<Page<InvitationRow>> {
  const res = await db.select({
    table: "invitations", columns: INVITATION_COLUMNS, order: [{ column: "created_at", ascending: false }],
    limit: req.limit, offset: req.offset,
  });
  return toPage(mapRows(res.rows, decodeInvitationRow), req);
}

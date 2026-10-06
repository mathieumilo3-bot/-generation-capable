import type { AdminDb } from "./db";
import { decodeLedgerRow, type LedgerRow } from "./ledger";
import { decodeSupportRequest, type SupportRequest } from "./support";
import { AdminError } from "../lib/errors";
import { asArray, asRecord, mapRows, num, numOrNull, str, strOrNull, type JsonObject } from "../lib/decode";
import { toPage, type Page, type PageRequest } from "../lib/pagination";

export interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  status: string;
  walletId: string | null;
  availableCents: number;
  spentCents: number;
  videoCount: number;
  lastActivity: string | null;
  createdAt: string;
}

export function decodeCustomerRow(r: JsonObject): CustomerRow {
  return {
    id: str(r.id),
    name: str(r.name).trim(),
    email: strOrNull(r.email),
    company: strOrNull(r.company),
    status: str(r.status, "active"),
    walletId: strOrNull(r.wallet_id),
    availableCents: num(r.available_cents),
    spentCents: num(r.spent_cents),
    videoCount: num(r.video_count),
    lastActivity: strOrNull(r.last_activity),
    createdAt: str(r.created_at),
  };
}

export async function listCustomers(db: AdminDb, search: string, req: PageRequest): Promise<Page<CustomerRow>> {
  const raw = await db.rpc("admin_customers", {
    p_search: search.trim() === "" ? null : search.trim(),
    p_limit: req.limit,
    p_offset: req.offset,
  });
  return toPage(mapRows(raw, decodeCustomerRow), req);
}

export interface CustomerProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  status: string;
  locale: string;
  billing: JsonObject;
  acquisition: JsonObject;
  appVersion: string | null;
  platform: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface CustomerWallet {
  id: string;
  balanceCents: number;
  heldCents: number;
  status: string;
}

export interface CustomerPayment {
  id: string;
  provider: string;
  kind: string;
  amountCents: number;
  status: string;
  refundedCents: number;
  failureCode: string | null;
  failureDetail: string | null;
  platform: string | null;
  createdAt: string;
}

export interface CustomerProject {
  id: string;
  title: string;
  status: string;
  sourceMode: string;
  createdAt: string;
}

export interface CustomerJob {
  id: string;
  status: string;
  kind: string;
  priceCents: number;
  errorCode: string | null;
  createdAt: string;
  revenueCents: number | null;
  costMicro: number | null;
  marginCents: number | null;
}

export interface CustomerNote { id: string; authorId: string | null; note: string; createdAt: string }

export interface CustomerTotals { revenueCents: number; costMicro: number; marginCents: number }

export interface CustomerDetail {
  profile: CustomerProfile;
  wallet: CustomerWallet | null;
  transactions: LedgerRow[];
  payments: CustomerPayment[];
  projects: CustomerProject[];
  jobs: CustomerJob[];
  totals: CustomerTotals;
  notes: CustomerNote[];
  supportRequests: SupportRequest[];
}

/** Retourne null si le client n'existe pas (la RPC renvoie alors un profil nul). */
export function decodeCustomerDetail(raw: unknown): CustomerDetail | null {
  const r = asRecord(raw);
  const p = asRecord(r.profile);
  if (typeof p.id !== "string") return null;
  const w = asRecord(r.wallet);
  const t = asRecord(r.totals);
  return {
    profile: {
      id: str(p.id),
      email: strOrNull(p.email),
      firstName: strOrNull(p.first_name),
      lastName: strOrNull(p.last_name),
      company: strOrNull(p.company),
      status: str(p.status, "active"),
      locale: str(p.locale, "fr"),
      billing: asRecord(p.billing),
      acquisition: asRecord(p.acquisition),
      appVersion: strOrNull(p.app_version),
      platform: strOrNull(p.platform),
      lastSeenAt: strOrNull(p.last_seen_at),
      createdAt: str(p.created_at),
    },
    wallet: typeof w.id === "string"
      ? { id: w.id, balanceCents: num(w.balance_cents), heldCents: num(w.held_cents), status: str(w.status, "active") }
      : null,
    transactions: mapRows(r.transactions, decodeLedgerRow),
    payments: mapRows(r.payments, (x) => ({
      id: str(x.id), provider: str(x.provider), kind: str(x.kind), amountCents: num(x.amount_cents),
      status: str(x.status), refundedCents: num(x.refunded_cents), failureCode: strOrNull(x.failure_code),
      failureDetail: strOrNull(x.failure_detail_internal), platform: strOrNull(x.platform), createdAt: str(x.created_at),
    })),
    projects: mapRows(r.projects, (x) => ({
      id: str(x.id), title: str(x.title), status: str(x.status), sourceMode: str(x.source_mode), createdAt: str(x.created_at),
    })),
    jobs: mapRows(r.jobs, (x) => ({
      id: str(x.id), status: str(x.status), kind: str(x.kind), priceCents: num(x.price_cents),
      errorCode: strOrNull(x.error_code), createdAt: str(x.created_at),
      revenueCents: numOrNull(x.revenue_cents), costMicro: numOrNull(x.total_actual_cost_micro), marginCents: numOrNull(x.gross_margin_cents),
    })),
    totals: { revenueCents: num(t.revenue_cents), costMicro: num(t.cost_micro), marginCents: num(t.margin_cents) },
    notes: mapRows(r.notes, (x) => ({ id: str(x.id), authorId: strOrNull(x.author_id), note: str(x.note), createdAt: str(x.created_at) })),
    supportRequests: asArray(r.support_requests).map(asRecord).map(decodeSupportRequest),
  };
}

export async function fetchCustomerDetail(db: AdminDb, userId: string): Promise<CustomerDetail> {
  const detail = decodeCustomerDetail(await db.rpc("admin_customer_detail", { p_user_id: userId }));
  if (!detail) throw new AdminError("user_not_found");
  return detail;
}

export function customerDisplayName(p: Pick<CustomerProfile, "firstName" | "lastName" | "email">): string {
  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  return name !== "" ? name : p.email ?? "Client sans nom";
}

// ── Actions (écriture : admin uniquement, vérifié côté serveur) ─────────
export async function setUserStatus(db: AdminDb, userId: string, status: "active" | "suspended", reason: string): Promise<void> {
  await db.rpc("admin_set_user_status", { p_user_id: userId, p_status: status, p_reason: reason.trim() });
}

export async function addNote(db: AdminDb, userId: string, note: string): Promise<void> {
  await db.rpc("admin_add_note", { p_user_id: userId, p_note: note.trim() });
}

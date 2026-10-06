import type { AdminDb } from "./db";
import { mapRows, num, str, strOrNull } from "../lib/decode";
import { toPage, type Page, type PageRequest } from "../lib/pagination";

export interface PaymentRow {
  id: string;
  userId: string | null;
  walletId: string;
  provider: string;
  providerRef: string | null;
  kind: string;
  amountCents: number;
  status: string;
  refundedCents: number;
  failureCode: string | null;
  failureDetail: string | null;
  platform: string | null;
  createdAt: string;
  succeededAt: string | null;
}

export async function listPayments(db: AdminDb, status: string, req: PageRequest): Promise<Page<PaymentRow>> {
  const res = await db.select({
    table: "payments",
    columns: "id,user_id,wallet_id,provider,provider_ref,kind,amount_cents,status,refunded_cents,failure_code,failure_detail_internal,platform,created_at,succeeded_at",
    eq: status ? { status } : {},
    order: [{ column: "created_at", ascending: false }],
    limit: req.limit, offset: req.offset,
  });
  return toPage(mapRows(res.rows, (r) => ({
    id: str(r.id), userId: strOrNull(r.user_id), walletId: str(r.wallet_id), provider: str(r.provider),
    providerRef: strOrNull(r.provider_ref), kind: str(r.kind), amountCents: num(r.amount_cents), status: str(r.status),
    refundedCents: num(r.refunded_cents), failureCode: strOrNull(r.failure_code), failureDetail: strOrNull(r.failure_detail_internal),
    platform: strOrNull(r.platform), createdAt: str(r.created_at), succeededAt: strOrNull(r.succeeded_at),
  })), req);
}

export interface WebhookRow {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  status: string;
  attempts: number;
  error: string | null;
  payload: unknown;
  receivedAt: string;
  processedAt: string | null;
}

export interface WebhookFilter { status: string; provider: string }

export async function listWebhooks(db: AdminDb, filter: WebhookFilter, req: PageRequest): Promise<Page<WebhookRow>> {
  const eq: Record<string, string> = {};
  if (filter.status) eq.status = filter.status;
  if (filter.provider) eq.provider = filter.provider;
  const res = await db.select({
    table: "webhook_events", eq, order: [{ column: "received_at", ascending: false }], limit: req.limit, offset: req.offset,
  });
  return toPage(mapRows(res.rows, (r) => ({
    id: str(r.id), provider: str(r.provider), eventId: str(r.event_id), eventType: str(r.event_type), status: str(r.status),
    attempts: num(r.attempts, 1), error: strOrNull(r.error), payload: r.payload ?? null, receivedAt: str(r.received_at),
    processedAt: strOrNull(r.processed_at),
  })), req);
}

export async function countFailedWebhooks(db: AdminDb): Promise<number> {
  const res = await db.select({ table: "webhook_events", columns: "id", eq: { status: "failed" }, limit: 1, count: true });
  return res.count ?? 0;
}

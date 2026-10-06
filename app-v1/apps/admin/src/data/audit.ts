import type { AdminDb } from "./db";
import { likePattern } from "./db";
import { mapRows, num, str, strOrNull } from "../lib/decode";
import { toPage, type Page, type PageRequest } from "../lib/pagination";

export interface AuditRow {
  id: number;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  beforeData: unknown;
  afterData: unknown;
  reason: string | null;
  createdAt: string;
}

export interface AuditFilter {
  entity: string;
  actorId: string;
  action: string;
  entityId: string;
}

export const EMPTY_AUDIT_FILTER: AuditFilter = { entity: "", actorId: "", action: "", entityId: "" };

export async function listAuditLogs(db: AdminDb, f: AuditFilter, req: PageRequest): Promise<Page<AuditRow>> {
  const eq: Record<string, string> = {};
  if (f.entity) eq.entity = f.entity;
  if (f.actorId) eq.actor_id = f.actorId;
  if (f.entityId) eq.entity_id = f.entityId;
  const res = await db.select({
    table: "audit_logs",
    eq,
    ilike: f.action.trim() ? [{ column: "action", pattern: likePattern(f.action) }] : [],
    order: [{ column: "id", ascending: false }],
    limit: req.limit, offset: req.offset,
  });
  return toPage(mapRows(res.rows, (r) => ({
    id: num(r.id), actorId: strOrNull(r.actor_id), actorRole: strOrNull(r.actor_role), action: str(r.action),
    entity: str(r.entity), entityId: strOrNull(r.entity_id), beforeData: r.before_data ?? null, afterData: r.after_data ?? null,
    reason: strOrNull(r.reason), createdAt: str(r.created_at),
  })), req);
}

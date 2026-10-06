import type { AdminDb } from "./db";
import { mapRows, str, strOrNull, type JsonObject } from "../lib/decode";
import { toPage, type Page, type PageRequest } from "../lib/pagination";

export interface SupportRequest {
  id: string;
  userId: string | null;
  projectId: string | null;
  jobId: string | null;
  versionId: string | null;
  category: string;
  message: string;
  appVersion: string | null;
  platform: string | null;
  status: string;
  staffNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function decodeSupportRequest(r: JsonObject): SupportRequest {
  return {
    id: str(r.id),
    userId: strOrNull(r.user_id),
    projectId: strOrNull(r.project_id),
    jobId: strOrNull(r.job_id),
    versionId: strOrNull(r.version_id),
    category: str(r.category, "other"),
    message: str(r.message),
    appVersion: strOrNull(r.app_version),
    platform: strOrNull(r.platform),
    status: str(r.status, "open"),
    staffNotes: strOrNull(r.staff_notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export interface SupportFilter { status: string; category: string }

export async function listSupportRequests(db: AdminDb, filter: SupportFilter, req: PageRequest): Promise<Page<SupportRequest>> {
  const eq: Record<string, string> = {};
  if (filter.status) eq.status = filter.status;
  if (filter.category) eq.category = filter.category;
  const res = await db.select({
    table: "support_requests", eq, order: [{ column: "created_at", ascending: false }],
    limit: req.limit, offset: req.offset,
  });
  return toPage(mapRows(res.rows, decodeSupportRequest), req);
}

export async function countOpenSupportRequests(db: AdminDb): Promise<number> {
  const res = await db.select({ table: "support_requests", columns: "id", eq: { status: "open" }, limit: 1, count: true });
  return res.count ?? 0;
}

export type SupportStatus = "open" | "in_progress" | "resolved";

export const STAFF_NOTES_MAX = 4000;

/** Changement de statut / note interne (RPC ouvert aux rôles support et admin ; aucune action financière). */
export async function updateSupportRequest(db: AdminDb, id: string, status: SupportStatus, staffNotes: string | null): Promise<void> {
  const notes = staffNotes === null ? null : staffNotes.trim();
  await db.rpc("admin_update_support_request", {
    p_id: id,
    p_status: status,
    p_staff_notes: notes === "" ? null : notes,
  });
}

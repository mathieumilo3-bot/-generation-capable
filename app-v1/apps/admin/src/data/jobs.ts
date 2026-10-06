import type { AdminDb } from "./db";
import { decodeLedgerRow, type LedgerRow } from "./ledger";
import { asRecord, bool, mapRows, num, numOrNull, str, strOrNull, type JsonObject } from "../lib/decode";
import { AdminError } from "../lib/errors";
import { toPage, type Page, type PageRequest } from "../lib/pagination";

export interface JobListRow {
  id: string;
  correlationId: string;
  status: string;
  kind: string;
  progress: number;
  currentStage: string | null;
  priceCents: number;
  errorCode: string | null;
  attemptCount: number;
  createdAt: string;
  completedAt: string | null;
  userId: string;
  email: string | null;
  costMicro: number | null;
  marginCents: number | null;
}

export function decodeJobListRow(r: JsonObject): JobListRow {
  return {
    id: str(r.id),
    correlationId: str(r.correlation_id),
    status: str(r.status),
    kind: str(r.kind, "create"),
    progress: num(r.progress),
    currentStage: strOrNull(r.current_stage),
    priceCents: num(r.price_cents),
    errorCode: strOrNull(r.error_code),
    attemptCount: num(r.attempt_count),
    createdAt: str(r.created_at),
    completedAt: strOrNull(r.completed_at),
    userId: str(r.user_id),
    email: strOrNull(r.email),
    costMicro: numOrNull(r.total_actual_cost_micro),
    marginCents: numOrNull(r.gross_margin_cents),
  };
}

export async function listJobs(db: AdminDb, status: string, req: PageRequest): Promise<Page<JobListRow>> {
  const raw = await db.rpc("admin_list_jobs", {
    p_status: status === "" ? null : status,
    p_limit: req.limit,
    p_offset: req.offset,
  });
  return toPage(mapRows(raw, decodeJobListRow), req);
}

export interface JobRecord {
  id: string;
  correlationId: string;
  kind: string;
  projectId: string;
  versionId: string;
  userId: string;
  walletId: string;
  sourceMode: string;
  editingMethodSlug: string | null;
  requestedDurationSec: number;
  aspectRatio: string;
  instructions: string | null;
  priceCents: number;
  walletHoldId: string | null;
  status: string;
  progress: number;
  currentStage: string | null;
  attemptCount: number;
  maxAttempts: number;
  cancelRequested: boolean;
  errorCode: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface JobInternals {
  engineVersion: string | null;
  engineJobRef: string | null;
  lockedBy: string | null;
  errorMessageInternal: string | null;
  inputManifest: unknown;
}

export const COST_CATEGORIES = [
  { key: "transcription_cost_micro", label: "Transcription" },
  { key: "llm_cost_micro", label: "Modèle de langage" },
  { key: "generation_cost_micro", label: "Génération" },
  { key: "render_compute_cost_micro", label: "Calcul de rendu" },
  { key: "storage_cost_micro", label: "Stockage" },
  { key: "music_cost_micro", label: "Musique" },
  { key: "external_api_cost_micro", label: "API externes" },
  { key: "other_cost_micro", label: "Autres" },
] as const;

export interface JobCosts {
  categories: Array<{ key: string; label: string; micro: number }>;
  totalMicro: number;
  revenueCents: number;
  marginCents: number;
  fxRateUsdEur: number | null;
}

export interface JobEvent {
  id: number;
  correlationId: string;
  source: string;
  level: string;
  stage: string | null;
  message: string;
  data: unknown;
  createdAt: string;
}

export interface JobDetail {
  job: JobRecord;
  internals: JobInternals | null;
  costs: JobCosts | null;
  events: JobEvent[];
  transactions: LedgerRow[];
}

export function decodeJobDetail(raw: unknown): JobDetail | null {
  const r = asRecord(raw);
  const j = asRecord(r.job);
  if (typeof j.id !== "string") return null;
  const i = asRecord(r.internals);
  const c = asRecord(r.costs);
  return {
    job: {
      id: str(j.id), correlationId: str(j.correlation_id), kind: str(j.kind, "create"), projectId: str(j.project_id),
      versionId: str(j.version_id), userId: str(j.user_id), walletId: str(j.wallet_id), sourceMode: str(j.source_mode),
      editingMethodSlug: strOrNull(j.editing_method_slug), requestedDurationSec: num(j.requested_duration_sec),
      aspectRatio: str(j.aspect_ratio), instructions: strOrNull(j.instructions), priceCents: num(j.price_cents),
      walletHoldId: strOrNull(j.wallet_hold_id), status: str(j.status), progress: num(j.progress),
      currentStage: strOrNull(j.current_stage), attemptCount: num(j.attempt_count), maxAttempts: num(j.max_attempts),
      cancelRequested: bool(j.cancel_requested), errorCode: strOrNull(j.error_code), createdAt: str(j.created_at),
      startedAt: strOrNull(j.started_at), completedAt: strOrNull(j.completed_at),
    },
    internals: typeof i.job_id === "string"
      ? {
          engineVersion: strOrNull(i.engine_version), engineJobRef: strOrNull(i.engine_job_ref), lockedBy: strOrNull(i.locked_by),
          errorMessageInternal: strOrNull(i.error_message_internal), inputManifest: i.input_manifest ?? null,
        }
      : null,
    costs: typeof c.id === "string"
      ? {
          categories: COST_CATEGORIES.map((cat) => ({ key: cat.key, label: cat.label, micro: num(c[cat.key]) })),
          totalMicro: num(c.total_actual_cost_micro),
          revenueCents: num(c.revenue_cents),
          marginCents: num(c.gross_margin_cents),
          fxRateUsdEur: numOrNull(c.fx_rate_usd_eur),
        }
      : null,
    events: mapRows(r.events, (e) => ({
      id: num(e.id), correlationId: str(e.correlation_id), source: str(e.source), level: str(e.level, "info"),
      stage: strOrNull(e.stage), message: str(e.message), data: e.data ?? null, createdAt: str(e.created_at),
    })),
    transactions: mapRows(r.transactions, decodeLedgerRow),
  };
}

export async function fetchJobDetail(db: AdminDb, jobId: string): Promise<JobDetail> {
  const detail = decodeJobDetail(await db.rpc("admin_job_detail", { p_job_id: jobId }));
  if (!detail) throw new AdminError("job_not_found");
  return detail;
}

export type RetryResult = { ok: true } | { ok: false; code: string; shortfallCents?: number };

/**
 * Relance « sûre » (voir admin_retry_job) : un nouveau montant est RÉSERVÉ sur le solde,
 * jamais de double encaissement. Seul un job `failed` est éligible.
 */
export async function retryJob(db: AdminDb, jobId: string, reason: string): Promise<RetryResult> {
  const r = asRecord(await db.rpc("admin_retry_job", { p_job_id: jobId, p_reason: reason.trim() }));
  if (r.ok === true) return { ok: true };
  const shortfall = numOrNull(r.shortfall_cents);
  return shortfall === null
    ? { ok: false, code: str(r.code, "unknown") }
    : { ok: false, code: str(r.code, "unknown"), shortfallCents: shortfall };
}

export type RefundResult =
  | { ok: true; transactionId: string; replayed: boolean }
  | { ok: false; code: string };

export async function refundJob(db: AdminDb, jobId: string, reason: string, idempotencyKey: string): Promise<RefundResult> {
  if (idempotencyKey.length < 8) throw new AdminError("idempotency_key_required");
  const r = asRecord(await db.rpc("admin_refund_job", {
    p_job_id: jobId, p_reason: reason.trim(), p_idempotency_key: idempotencyKey,
  }));
  if (r.ok === true) return { ok: true, transactionId: str(r.transaction_id), replayed: bool(r.replayed) };
  return { ok: false, code: str(r.code, "unknown") };
}

/** Un job peut être relancé uniquement s'il est en échec. */
export function canRetry(status: string): boolean {
  return status === "failed";
}

/** Remboursable : terminé, payant, et pas déjà remboursé (écriture « refund » absente du ledger du job). */
export function canRefund(job: Pick<JobRecord, "status" | "priceCents">, transactions: readonly LedgerRow[]): boolean {
  return job.status === "completed" && job.priceCents > 0 && !transactions.some((t) => t.type === "refund");
}

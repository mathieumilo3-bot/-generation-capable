import type { SupabaseClient } from "@supabase/supabase-js";

/** Contrat avec la base : UNIQUEMENT les RPC `svc_*` (service_role). Deux implémentations : Supabase (prod) et pg (tests / auto-hébergé). */
export interface ClaimedJob {
  job_id: string; correlation_id: string; kind: "create" | "revision"; user_id: string; project_id: string; version_id: string;
  aspect_ratio: string; requested_duration_sec: number; instructions: string | null; editing_method_slug: string | null;
  attempt: number; engine_job_ref: string | null;
  input_manifest: {
    assets?: { asset_id: string; kind: "raw" | "reference" | "image" | "logo" | "audio_note"; bucket: string; path: string; filename: string; mime_type: string; size_bytes: number; duration_sec: number | null }[];
    method?: { slug: string; version: number; engine_config: { preset_id?: string; use_references?: boolean } };
    brief?: string | null;
    revision?: { parent_version_id: string; parent_job_id: string; instruction: string };
  };
}

export interface PendingPush { notification_id: string; user_id: string; title: string; body: string; data: Record<string, unknown>; token: string; platform: string }
export interface PendingEmail { kind: "welcome" | "notification"; ref_id: string; user_id: string; email: string; first_name: string | null; title: string; body: string; data: Record<string, unknown> }
export interface PurgeItem { asset_id: string; bucket: string; path: string }
export interface VersionPurge { version_id: string; project_id: string; user_id: string; render_path: string | null; thumbnail_path: string | null }

export interface Store {
  claim(worker: string, leaseSeconds: number): Promise<ClaimedJob | null>;
  progress(a: { jobId: string; status: "preparing" | "analyzing" | "editing" | "rendering" | "quality_check"; progress: number; stage?: string | null; engineJobRef?: string | null; engineVersion?: string | null; leaseSeconds: number }): Promise<{ ok: boolean; cancel_requested?: boolean }>;
  complete(a: { jobId: string; renderPath: string; thumbnailPath: string | null; durationSec: number; width: number; height: number; sizeBytes: number }): Promise<void>;
  fail(a: { jobId: string; code: string; message: string; retryable: boolean }): Promise<{ requeued?: boolean; status?: string }>;
  cancelled(jobId: string): Promise<void>;
  event(jobId: string, level: "debug" | "info" | "warn" | "error", stage: string, message: string, data?: Record<string, unknown>): Promise<void>;
  recordCosts(jobId: string, costs: Record<string, number>, fx: number): Promise<void>;
  requeueStale(): Promise<number>;
  syncCapabilities(version: string, caps: Record<string, unknown>): Promise<boolean>;
  pendingPushes(limit: number): Promise<PendingPush[]>;
  markPushSent(ids: string[]): Promise<void>;
  dropPushToken(token: string): Promise<void>;
  pendingEmails(limit: number): Promise<PendingEmail[]>;
  markEmailSent(kind: string, ref: string): Promise<void>;
  assetsToPurge(limit: number): Promise<PurgeItem[]>;
  assetPurged(id: string): Promise<void>;
  expireContent(): Promise<{ assets_marked: number }>;
  versionsToPurge(limit: number): Promise<VersionPurge[]>;
  versionPurged(id: string): Promise<void>;
  notifyExpiring(hoursBefore: number): Promise<number>;
}

export class SupabaseStore implements Store {
  constructor(private sb: SupabaseClient) {}
  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }
  claim(worker: string, leaseSeconds: number) { return this.rpc<ClaimedJob | null>("svc_claim_job", { p_worker: worker, p_lease_seconds: leaseSeconds }); }
  progress(a: Parameters<Store["progress"]>[0]) {
    return this.rpc<{ ok: boolean; cancel_requested?: boolean }>("svc_job_progress", {
      p_job_id: a.jobId, p_status: a.status, p_progress: Math.round(a.progress), p_stage: a.stage ?? null,
      p_engine_job_ref: a.engineJobRef ?? null, p_engine_version: a.engineVersion ?? null, p_lease_seconds: a.leaseSeconds,
    });
  }
  async complete(a: Parameters<Store["complete"]>[0]) {
    await this.rpc("svc_job_complete", { p_job_id: a.jobId, p_render_path: a.renderPath, p_thumbnail_path: a.thumbnailPath, p_duration_sec: a.durationSec, p_width: a.width, p_height: a.height, p_size_bytes: a.sizeBytes });
  }
  fail(a: Parameters<Store["fail"]>[0]) { return this.rpc<{ requeued?: boolean; status?: string }>("svc_job_fail", { p_job_id: a.jobId, p_error_code: a.code, p_internal_message: a.message, p_retryable: a.retryable }); }
  async cancelled(jobId: string) { await this.rpc("svc_job_cancelled", { p_job_id: jobId }); }
  async event(jobId: string, level: string, stage: string, message: string, data: Record<string, unknown> = {}) { await this.rpc("svc_job_event", { p_job_id: jobId, p_source: "orchestrator", p_level: level, p_stage: stage, p_message: message, p_data: data }); }
  async recordCosts(jobId: string, costs: Record<string, number>, fx: number) { await this.rpc("svc_record_costs", { p_job_id: jobId, p_costs: costs, p_fx_usd_eur: fx }); }
  requeueStale() { return this.rpc<number>("svc_requeue_stale_jobs"); }
  syncCapabilities(version: string, caps: Record<string, unknown>) { return this.rpc<boolean>("svc_sync_capabilities", { p_engine_version: version, p_caps: caps }); }
  pendingPushes(limit: number) { return this.rpc<PendingPush[]>("svc_pending_pushes", { p_limit: limit }); }
  async markPushSent(ids: string[]) { if (ids.length) await this.rpc("svc_mark_push_sent", { p_ids: ids }); }
  async dropPushToken(token: string) { await this.rpc("svc_drop_push_token", { p_token: token }); }
  pendingEmails(limit: number) { return this.rpc<PendingEmail[]>("svc_pending_emails", { p_limit: limit }); }
  async markEmailSent(kind: string, ref: string) { await this.rpc("svc_mark_email_sent", { p_kind: kind, p_ref: ref }); }
  assetsToPurge(limit: number) { return this.rpc<PurgeItem[]>("svc_assets_to_purge", { p_limit: limit }); }
  async assetPurged(id: string) { await this.rpc("svc_asset_purged", { p_asset_id: id }); }
  expireContent() { return this.rpc<{ assets_marked: number }>("svc_expire_content"); }
  versionsToPurge(limit: number) { return this.rpc<VersionPurge[]>("svc_versions_to_purge", { p_limit: limit }); }
  async versionPurged(id: string) { await this.rpc("svc_version_purged", { p_version_id: id }); }
  notifyExpiring(h: number) { return this.rpc<number>("svc_notify_expiring", { p_hours_before: h }); }
}

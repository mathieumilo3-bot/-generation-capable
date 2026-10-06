import pg from "pg";
import type { ClaimedJob, PendingEmail, PendingPush, PurgeItem, Store } from "./store.ts";

/** Même contrat que SupabaseStore, via une connexion Postgres directe (tests d'intégration, déploiement auto-hébergé). */
export class PgStore implements Store {
  constructor(private pool: pg.Pool) {}
  private async one<T>(sql: string, params: unknown[] = []): Promise<T> {
    const r = await this.pool.query(sql, params);
    return r.rows[0]?.v as T;
  }
  private async rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pool.query(sql, params)).rows as T[];
  }
  claim(worker: string, lease: number) { return this.one<ClaimedJob | null>("select public.svc_claim_job($1,$2) as v", [worker, lease]); }
  progress(a: Parameters<Store["progress"]>[0]) {
    return this.one<{ ok: boolean; cancel_requested?: boolean }>("select public.svc_job_progress($1,$2,$3,$4,$5,$6,$7) as v",
      [a.jobId, a.status, Math.round(a.progress), a.stage ?? null, a.engineJobRef ?? null, a.engineVersion ?? null, a.leaseSeconds]);
  }
  async complete(a: Parameters<Store["complete"]>[0]) {
    await this.pool.query("select public.svc_job_complete($1,$2,$3,$4,$5,$6,$7)", [a.jobId, a.renderPath, a.thumbnailPath, a.durationSec, a.width, a.height, a.sizeBytes]);
  }
  fail(a: Parameters<Store["fail"]>[0]) { return this.one<{ requeued?: boolean; status?: string }>("select public.svc_job_fail($1,$2,$3,$4) as v", [a.jobId, a.code, a.message, a.retryable]); }
  async cancelled(id: string) { await this.pool.query("select public.svc_job_cancelled($1)", [id]); }
  async event(jobId: string, level: string, stage: string, message: string, data: Record<string, unknown> = {}) {
    await this.pool.query("select public.svc_job_event($1,'orchestrator',$2,$3,$4,$5)", [jobId, level, stage, message, JSON.stringify(data)]);
  }
  async recordCosts(jobId: string, costs: Record<string, number>, fx: number) { await this.pool.query("select public.svc_record_costs($1,$2,$3)", [jobId, JSON.stringify(costs), fx]); }
  async requeueStale() { return Number(await this.one<number>("select public.svc_requeue_stale_jobs() as v")); }
  syncCapabilities(version: string, caps: Record<string, unknown>) { return this.one<boolean>("select public.svc_sync_capabilities($1,$2) as v", [version, JSON.stringify(caps)]); }
  pendingPushes(limit: number) { return this.rows<PendingPush>("select * from public.svc_pending_pushes($1)", [limit]); }
  async markPushSent(ids: string[]) { if (ids.length) await this.pool.query("select public.svc_mark_push_sent($1::uuid[])", [ids]); }
  async dropPushToken(t: string) { await this.pool.query("select public.svc_drop_push_token($1)", [t]); }
  pendingEmails(limit: number) { return this.rows<PendingEmail>("select * from public.svc_pending_emails($1)", [limit]); }
  async markEmailSent(kind: string, ref: string) { await this.pool.query("select public.svc_mark_email_sent($1,$2)", [kind, ref]); }
  assetsToPurge(limit: number) { return this.rows<PurgeItem>("select * from public.svc_assets_to_purge($1)", [limit]); }
  async assetPurged(id: string) { await this.pool.query("select public.svc_asset_purged($1)", [id]); }
}

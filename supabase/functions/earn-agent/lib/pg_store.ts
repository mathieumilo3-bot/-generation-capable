import postgres from 'npm:postgres@3.4.5';
import type { JobRow, JobStatus, LedgerRow, ListingRow, RunRow, Store } from './store.ts';

type Sql = ReturnType<typeof postgres>;

const JSON_COLUMNS = new Set(['live', 'details', 'assessment', 'qa_report', 'submission_response', 'stats', 'value']);

/** postgres.js returns Date for timestamptz; the pipeline works with ISO strings. */
function norm<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
  return out as T;
}

export class PgStore implements Store {
  private sql: Sql;
  constructor(url: string) {
    this.sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20 });
  }

  private j(v: unknown) {
    return v == null ? null : this.sql.json(v as never);
  }

  private wrap(patch: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) out[k] = JSON_COLUMNS.has(k) ? this.j(v) : v;
    return out;
  }

  async getConfig<T>(key: string): Promise<T | null> {
    const [r] = await this.sql`select value from earn_agent.config where key = ${key}`;
    return (r?.value as T) ?? null;
  }

  async setConfig(key: string, value: unknown): Promise<void> {
    await this.sql`
      insert into earn_agent.config (key, value, updated_at) values (${key}, ${this.j(value)}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
  }

  async getSecret(name: string): Promise<string | null> {
    const [r] = await this.sql`select decrypted_secret from vault.decrypted_secrets where name = ${name} limit 1`;
    return (r?.decrypted_secret as string) ?? null;
  }

  async setSecret(name: string, value: string, description: string): Promise<void> {
    const [r] = await this.sql`select id from vault.secrets where name = ${name} limit 1`;
    if (r) await this.sql`select vault.update_secret(${r.id}::uuid, ${value})`;
    else await this.sql`select vault.create_secret(${value}, ${name}, ${description})`;
  }

  async tryLock(name: string, ttlSeconds: number): Promise<boolean> {
    const rows = await this.sql`
      insert into earn_agent.locks (name, until) values (${name}, now() + make_interval(secs => ${ttlSeconds}))
      on conflict (name) do update set until = excluded.until
        where earn_agent.locks.until < now()
      returning name`;
    return rows.length === 1;
  }

  async unlock(name: string): Promise<void> {
    await this.sql`delete from earn_agent.locks where name = ${name}`;
  }

  async getListing(id: string): Promise<ListingRow | null> {
    const [r] = await this.sql`select * from earn_agent.listings where id = ${id}`;
    return r ? norm<ListingRow>(r) : null;
  }

  async listListings(onlyLive: boolean): Promise<ListingRow[]> {
    const rows = onlyLive
      ? await this.sql`select * from earn_agent.listings where is_live order by score desc nulls last`
      : await this.sql`select * from earn_agent.listings order by last_seen_at desc`;
    return rows.map((r) => norm<ListingRow>(r));
  }

  async upsertListing(row: Omit<ListingRow, 'first_seen_at' | 'last_seen_at'>): Promise<void> {
    const v = this.wrap({
      id: row.id,
      slug: row.slug,
      title: row.title,
      type: row.type,
      token: row.token,
      deadline: row.deadline,
      live: row.live,
      details: row.details,
      details_fetched_at: row.details_fetched_at,
      assessment: row.assessment,
      score: row.score,
      decision: row.decision,
      decision_reason: row.decision_reason,
      is_live: row.is_live,
    });
    await this.sql`
      insert into earn_agent.listings ${this.sql(v)}
      on conflict (id) do update set
        slug = excluded.slug, title = excluded.title, type = excluded.type, token = excluded.token,
        deadline = excluded.deadline, live = excluded.live, details = excluded.details,
        details_fetched_at = excluded.details_fetched_at, assessment = excluded.assessment,
        score = excluded.score, decision = excluded.decision, decision_reason = excluded.decision_reason,
        is_live = excluded.is_live, last_seen_at = now()`;
  }

  async markNotLive(liveIds: string[]): Promise<number> {
    const rows = await this.sql`
      update earn_agent.listings set is_live = false
      where is_live and not (id = any(${liveIds}::text[])) returning id`;
    return rows.length;
  }

  async listJobs(statuses?: JobStatus[]): Promise<JobRow[]> {
    const rows = statuses
      ? await this.sql`select * from earn_agent.jobs where status = any(${statuses}::text[]) order by priority desc`
      : await this.sql`select * from earn_agent.jobs order by queued_at desc`;
    return rows.map((r) => norm<JobRow>(r));
  }

  async getJobByListing(listingId: string): Promise<JobRow | null> {
    const [r] = await this.sql`select * from earn_agent.jobs where listing_id = ${listingId}`;
    return r ? norm<JobRow>(r) : null;
  }

  async createJob(listingId: string, slug: string, priority: number): Promise<JobRow> {
    const [r] = await this.sql`
      insert into earn_agent.jobs (listing_id, slug, priority) values (${listingId}, ${slug}, ${priority})
      returning *`;
    return norm<JobRow>(r);
  }

  async updateJob(id: string, patch: Partial<JobRow>): Promise<void> {
    const v = this.wrap({ ...patch, updated_at: new Date().toISOString() });
    delete v.id;
    await this.sql`update earn_agent.jobs set ${this.sql(v)} where id = ${id}`;
  }

  async countSubmittedSince(since: Date): Promise<number> {
    const [r] = await this.sql`
      select count(*)::int as n from earn_agent.jobs where status = 'submitted' and submitted_at >= ${since}`;
    return r.n as number;
  }

  async listLedger(): Promise<LedgerRow[]> {
    const rows = await this.sql`select * from earn_agent.ledger order by submitted_at desc`;
    return rows.map((r) => norm<LedgerRow>(r));
  }

  async upsertLedger(row: LedgerRow): Promise<void> {
    const v = { ...row, updated_at: new Date().toISOString() } as Record<string, unknown>;
    const cols = Object.keys(v).filter((k) => k !== 'listing_id');
    await this.sql`
      insert into earn_agent.ledger ${this.sql(v)}
      on conflict (listing_id) do update set ${this.sql(
        Object.fromEntries(cols.map((c) => [c, v[c]])),
      )}`;
  }

  async startRun(kind: string): Promise<number> {
    const [r] = await this.sql`insert into earn_agent.runs (kind) values (${kind}) returning id`;
    return Number(r.id);
  }

  async finishRun(id: number, ok: boolean, stats: unknown, error: string | null): Promise<void> {
    await this.sql`
      update earn_agent.runs set finished_at = now(), ok = ${ok}, stats = ${this.j(stats)}, error = ${error}
      where id = ${id}`;
  }

  async recentRuns(limit: number): Promise<RunRow[]> {
    const rows = await this.sql`select * from earn_agent.runs order by id desc limit ${limit}`;
    return rows.map((r) => norm<RunRow>({ ...r, id: Number(r.id) }));
  }
}

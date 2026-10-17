import type { Assessment, ListingDetails, LiveListing } from './types.ts';

export type JobStatus =
  | 'queued' // waiting for the AI worker
  | 'rejected_qa' // worker delivered, hub gate refused it (worker may fix)
  | 'delivered' // passed the gate, submission pending (rate limit / transient)
  | 'approved' // passed the gate, autoSubmit off
  | 'submitted'
  | 'submit_failed'
  | 'abandoned' // worker found it cannot be done honestly
  | 'expired';

export const ACTIVE_JOB_STATUSES: JobStatus[] = ['queued', 'rejected_qa', 'delivered', 'submit_failed'];

export interface ListingRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  token: string | null;
  deadline: string | null;
  live: LiveListing;
  details: ListingDetails | null;
  details_fetched_at: string | null;
  assessment: Assessment | null;
  score: number | null;
  decision: string | null;
  decision_reason: string | null;
  is_live: boolean;
  first_seen_at: string;
  last_seen_at: string;
}

export interface JobRow {
  id: string;
  listing_id: string;
  slug: string;
  status: JobStatus;
  priority: number;
  queued_at: string;
  delivered_at: string | null;
  submitted_at: string | null;
  commit_sha: string | null;
  deliverable_url: string | null;
  manifest_hash: string | null;
  qa_report: unknown;
  submission_id: string | null;
  submission_response: unknown;
  attempts: number;
  last_error: string | null;
  updated_at: string;
}

export interface LedgerRow {
  listing_id: string;
  slug: string;
  title: string;
  submission_id: string | null;
  submitted_at: string;
  link: string | null;
  token: string | null;
  prize_pool: number | null;
  first_prize: number | null;
  expected_usd: number | null;
  outcome: 'pending' | 'won' | 'lost' | 'unknown';
  winner_position: number | null;
  amount_won: number | null;
  amount_won_usd: number | null;
  payout_status: string | null;
  checked_at: string | null;
}

export interface RunRow {
  id: number;
  kind: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  stats: unknown;
  error: string | null;
}

export interface Store {
  getConfig<T>(key: string): Promise<T | null>;
  setConfig(key: string, value: unknown): Promise<void>;
  getSecret(name: string): Promise<string | null>;
  setSecret(name: string, value: string, description: string): Promise<void>;
  /** Atomic lease; false if someone else holds it. */
  tryLock(name: string, ttlSeconds: number): Promise<boolean>;
  unlock(name: string): Promise<void>;

  getListing(id: string): Promise<ListingRow | null>;
  listListings(onlyLive: boolean): Promise<ListingRow[]>;
  upsertListing(row: Omit<ListingRow, 'first_seen_at' | 'last_seen_at'>): Promise<void>;
  markNotLive(liveIds: string[]): Promise<number>;

  listJobs(statuses?: JobStatus[]): Promise<JobRow[]>;
  getJobByListing(listingId: string): Promise<JobRow | null>;
  createJob(listingId: string, slug: string, priority: number): Promise<JobRow>;
  updateJob(id: string, patch: Partial<JobRow>): Promise<void>;
  countSubmittedSince(since: Date): Promise<number>;

  listLedger(): Promise<LedgerRow[]>;
  upsertLedger(row: LedgerRow): Promise<void>;

  startRun(kind: string): Promise<number>;
  finishRun(id: number, ok: boolean, stats: unknown, error: string | null): Promise<void>;
  recentRuns(limit: number): Promise<RunRow[]>;
}

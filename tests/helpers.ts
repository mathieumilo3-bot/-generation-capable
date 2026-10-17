import type { JobRow, JobStatus, LedgerRow, ListingRow, RunRow, Store } from '../supabase/functions/earn-agent/lib/store.ts';
import type { ListingDetails, LiveListing, Manifest } from '../supabase/functions/earn-agent/lib/types.ts';

export class MemoryStore implements Store {
  config = new Map<string, unknown>();
  secrets = new Map<string, string>();
  locks = new Map<string, number>();
  listings = new Map<string, ListingRow>();
  jobs = new Map<string, JobRow>();
  ledger = new Map<string, LedgerRow>();
  runs: RunRow[] = [];
  private seq = 0;
  private now: () => Date;
  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  async getConfig<T>(k: string) {
    return (structuredClone(this.config.get(k)) as T) ?? null;
  }
  async setConfig(k: string, v: unknown) {
    this.config.set(k, structuredClone(v));
  }
  async getSecret(n: string) {
    return this.secrets.get(n) ?? null;
  }
  async setSecret(n: string, v: string, _description = "") {
    this.secrets.set(n, v);
  }
  async tryLock(n: string, ttl: number) {
    const until = this.locks.get(n);
    if (until && until > this.now().getTime()) return false;
    this.locks.set(n, this.now().getTime() + ttl * 1000);
    return true;
  }
  async unlock(n: string) {
    this.locks.delete(n);
  }
  async getListing(id: string) {
    return structuredClone(this.listings.get(id)) ?? null;
  }
  async listListings(onlyLive: boolean) {
    return [...this.listings.values()].filter((l) => !onlyLive || l.is_live).map((l) => structuredClone(l));
  }
  async upsertListing(row: Omit<ListingRow, 'first_seen_at' | 'last_seen_at'>) {
    const prev = this.listings.get(row.id);
    const t = this.now().toISOString();
    this.listings.set(row.id, structuredClone({ ...row, first_seen_at: prev?.first_seen_at ?? t, last_seen_at: t }) as ListingRow);
  }
  async markNotLive(ids: string[]) {
    let n = 0;
    for (const l of this.listings.values()) if (l.is_live && !ids.includes(l.id)) (l.is_live = false), n++;
    return n;
  }
  async listJobs(statuses?: JobStatus[]) {
    return [...this.jobs.values()].filter((j) => !statuses || statuses.includes(j.status)).map((j) => structuredClone(j));
  }
  async getJobByListing(id: string) {
    return structuredClone([...this.jobs.values()].find((j) => j.listing_id === id)) ?? null;
  }
  async createJob(listingId: string, slug: string, priority: number) {
    const t = this.now().toISOString();
    const j: JobRow = {
      id: `job-${++this.seq}`,
      listing_id: listingId,
      slug,
      status: 'queued',
      priority,
      queued_at: t,
      delivered_at: null,
      submitted_at: null,
      commit_sha: null,
      deliverable_url: null,
      manifest_hash: null,
      qa_report: null,
      submission_id: null,
      submission_response: null,
      attempts: 0,
      last_error: null,
      updated_at: t,
    };
    this.jobs.set(j.id, j);
    return structuredClone(j);
  }
  async updateJob(id: string, patch: Partial<JobRow>) {
    this.jobs.set(id, { ...this.jobs.get(id)!, ...structuredClone(patch), updated_at: this.now().toISOString() });
  }
  async countSubmittedSince(since: Date) {
    return [...this.jobs.values()].filter((j) => j.status === 'submitted' && j.submitted_at && new Date(j.submitted_at) >= since).length;
  }
  async listLedger() {
    return [...this.ledger.values()].map((r) => structuredClone(r));
  }
  async upsertLedger(r: LedgerRow) {
    this.ledger.set(r.listing_id, structuredClone(r));
  }
  async startRun(kind: string) {
    const id = this.runs.length + 1;
    this.runs.push({ id, kind, started_at: this.now().toISOString(), finished_at: null, ok: null, stats: null, error: null });
    return id;
  }
  async finishRun(id: number, ok: boolean, stats: unknown, error: string | null) {
    Object.assign(this.runs[id - 1], { ok, stats, error, finished_at: this.now().toISOString() });
  }
  async recentRuns(limit: number) {
    return [...this.runs].reverse().slice(0, limit);
  }
}

export const NOW = new Date('2026-10-17T12:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

export function writingListing(over: Partial<ListingDetails & LiveListing> = {}): ListingDetails & LiveListing {
  return {
    id: 'lst-writing',
    slug: 'write-a-developer-guide-to-solana-actions',
    title: 'Write a developer guide to Solana Actions',
    type: 'bounty',
    token: 'USDC',
    rewardAmount: 1000,
    rewards: { '1': 500, '2': 300, '3': 200 },
    maxBonusSpots: 0,
    deadline: days(7),
    publishedAt: days(-3),
    agentAccess: 'AGENT_ONLY',
    status: 'OPEN',
    compensationType: 'fixed',
    region: 'Global',
    isWinnersAnnounced: false,
    description:
      '<p>Write an in-depth article explaining Solana Actions and Blinks for developers. Publish it on any platform (Medium, Mirror, Notion or GitHub) and submit the link.</p><ul><li>At least 1500 words</li><li>Include code samples</li></ul>',
    skills: [{ skills: 'Content', subskills: ['Writing'] }],
    eligibility: [
      { order: 1, question: 'Title of your article', type: 'text' },
      { order: 2, question: 'Link to the code samples', type: 'link' },
      { order: 3, question: 'Anything else?', type: 'text', optional: true },
    ],
    sponsor: { name: 'Acme', slug: 'acme', isVerified: true },
    _count: { Submission: 4, Comments: 1 },
    ...over,
  } as ListingDetails & LiveListing;
}

export function hackathonListing(): ListingDetails & LiveListing {
  return writingListing({
    id: 'lst-hack',
    slug: 'build-a-defi-app-hackathon',
    title: 'Hackathon track: build a DeFi app',
    type: 'hackathon',
    rewards: { '1': 5000 },
    skills: [{ skills: 'Frontend', subskills: ['React'] }],
    eligibility: [],
  });
}

export function projectListing(): ListingDetails & LiveListing {
  return writingListing({
    id: 'lst-project',
    slug: 'frontend-developer-for-dashboard',
    title: 'Frontend developer for dashboard',
    type: 'project',
    compensationType: 'range',
    minRewardAsk: 500,
    maxRewardAsk: 2000,
    rewards: null,
    rewardAmount: null,
    skills: [{ skills: 'Frontend', subskills: ['React'] }],
    eligibility: [],
  });
}

export interface MockEarnState {
  listings: (ListingDetails & LiveListing)[];
  submissions: unknown[];
  winners: Record<string, { id: string; winnerPosition: number; user: { id: string; username: string } }[]>;
  registerCalls: number;
  submitStatus?: number;
  authHeaders: string[];
}

/** Fake superteam.fun + GitHub + price endpoints behind a single fetch. */
export function mockFetch(state: MockEarnState, repo: { headSha: string; files: Record<string, string> }) {
  const res = (body: unknown, status = 200) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  return async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input);
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    if (url.hostname === 'superteam.fun') {
      if (auth) state.authHeaders.push(auth);
      const p = url.pathname;
      if (p === '/api/agents' && init?.method === 'POST') {
        state.registerCalls++;
        return res({ agentId: 'agent-1', userId: 'user-agent-1', name: 'GenerationCapable AI Agent', username: 'generationcapable-x1', apiKey: 'sk_test_secret_key_123456', claimCode: 'CLAIM-SECRET' }, 201);
      }
      if (!p.startsWith('/api/listings/') && p !== '/api/tokens' && auth !== 'Bearer sk_test_secret_key_123456') return res({ error: 'Unauthorized' }, 401);
      if (p === '/api/agents/status') return res({ id: 'agent-1', name: 'x', status: 'ACTIVE', userId: 'user-agent-1', claimedByUserId: null });
      if (p === '/api/agents/listings/live') {
        const excluded = url.searchParams.getAll('excludeIds[]');
        return res(state.listings.filter((l) => !excluded.includes(l.id) && l.status === 'OPEN'));
      }
      if (p.startsWith('/api/agents/listings/details/')) {
        const slug = decodeURIComponent(p.split('/').pop()!);
        const l = state.listings.find((x) => x.slug === slug);
        return l ? res(l) : res({ message: 'not found' }, 404);
      }
      if (p === '/api/agents/submissions/create') {
        if (state.submitStatus) return res({ error: 'x' }, state.submitStatus);
        const body = JSON.parse(String(init?.body));
        state.submissions.push(body);
        return res({ id: `sub-${state.submissions.length}`, listingId: body.listingId });
      }
      const w = p.match(/^\/api\/listings\/([^/]+)\/winners$/);
      if (w) return res(state.winners[w[1]] ?? []);
      if (p === '/api/tokens') return res({ tokens: [{ tokenSymbol: 'SOL', mintAddress: 'So11111111111111111111111111111111111111112' }] });
      return res({ error: 'not found' }, 404);
    }
    if (url.hostname === 'github.com' && url.pathname.endsWith('/info/refs')) {
      return res(`001e# service=git-upload-pack\n0000${'0'.repeat(4)}${repo.headSha} refs/heads/earn-agent\n0000`);
    }
    if (url.hostname === 'github.com') return res('<html>ok</html>');
    if (url.hostname === 'raw.githubusercontent.com') {
      const [, , , sha, ...rest] = url.pathname.split('/');
      const path = rest.map(decodeURIComponent).join('/');
      if (sha !== repo.headSha) return res('wrong sha', 404);
      return path in repo.files ? res(repo.files[path]) : res('404', 404);
    }
    if (url.hostname === 'lite-api.jup.ag') return res({ So11111111111111111111111111111111111111112: { usdPrice: 150 } });
    if (url.hostname === 'api.coingecko.com') return res({});
    throw new Error(`unexpected fetch ${input}`);
  };
}

export const SHA = 'a'.repeat(40);
export const REPO = 'https://github.com/mathieumilo3-bot/-generation-capable';
export const slug = 'write-a-developer-guide-to-solana-actions';

export function goodManifest(over: Partial<Manifest> = {}): Manifest {
  return {
    version: 1,
    listingId: 'lst-writing',
    slug,
    status: 'ready',
    primaryFile: 'README.md',
    otherInfo:
      'A 1,800-word developer guide to Solana Actions and Blinks, with runnable TypeScript samples, produced by an AI agent.\n\n- Explains the Actions spec\n- Walks through a GET/POST handler',
    eligibilityAnswers: [
      { question: 'Title of your article', answer: 'Solana Actions for developers' },
      { question: 'Link to the code samples', answer: `${REPO}/tree/${SHA}/deliverables/${slug}` },
    ],
    qa: {
      score: 9,
      reviewer: 'independent-reviewer-subagent',
      checklist: [{ requirement: 'At least 1500 words', met: true, evidence: '1,812 words' }],
      originality: true,
      noFabrication: true,
      languageOk: true,
    },
    ...over,
  };
}


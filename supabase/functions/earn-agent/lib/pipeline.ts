import { EarnApiError, type EarnClient, type FetchFn } from './earn.ts';
import type { GitHubWorkspace } from './github.ts';
import { priceTokens, type PriceBook } from './prices.ts';
import { validateManifest } from './qa.ts';
import { assess, prizeStructure } from './scoring.ts';
import { ACTIVE_JOB_STATUSES, type JobRow, type LedgerRow, type ListingRow, type Store } from './store.ts';
import { htmlToText, sha256Hex } from './text.ts';
import { DEFAULT_SETTINGS, type AgentIdentity, type ListingDetails, type Manifest, type Settings } from './types.ts';

export const VERSION = 'earn-agent-hub/1.0.0';
export const AGENT_NAME = 'GenerationCapable AI Agent';

export interface Deps {
  store: Store;
  earn: EarnClient; // unauthenticated; authed() adds the key
  github: GitHubWorkspace;
  fetchFn?: FetchFn;
  now?: () => Date;
  log?: (msg: string) => void;
}

const DETAILS_TTL_H = 12;
const MAX_DETAILS_PER_TICK = 30;
const PRICE_TTL_H = 6;
const TRACK_EVERY_H = 6;
const MAX_SUBMIT_ATTEMPTS = 3;
/**
 * Jobs whose slug starts with this prefix are synthetic end-to-end checks of
 * the worker -> GitHub -> hub path: their brief comes from the stored listing,
 * they never expire with the live feed, and they are never submitted.
 */
export const SELFTEST_PREFIX = 'selftest-';

const JOB_DECISION: Record<JobRow['status'], string> = {
  queued: 'selected',
  rejected_qa: 'selected',
  delivered: 'selected',
  approved: 'approved',
  submit_failed: 'selected',
  submitted: 'submitted',
  abandoned: 'abandoned',
  expired: 'expired',
};

const nowOf = (d: Deps) => (d.now ? d.now() : new Date());
const hoursSince = (iso: string | null | undefined, now: Date) =>
  iso ? (now.getTime() - new Date(iso).getTime()) / 3_600_000 : Infinity;

export async function getSettings(store: Store): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await store.getConfig<Partial<Settings>>('settings')) ?? {}) };
}

async function authed(deps: Deps): Promise<EarnClient> {
  const key = await deps.store.getSecret('earn_agent_api_key');
  if (!key) throw new Error('agent not registered');
  return deps.earn.withKey(key);
}

/** Step 1 — register once; the API key and claim code go to Supabase Vault. */
export async function ensureRegistered(deps: Deps, name = AGENT_NAME): Promise<{ identity: AgentIdentity; created: boolean }> {
  const existing = await deps.store.getConfig<AgentIdentity>('agent');
  if (existing && (await deps.store.getSecret('earn_agent_api_key'))) return { identity: existing, created: false };
  if (!(await deps.store.tryLock('register', 120))) throw new Error('registration already in progress');
  try {
    const r = await deps.earn.register(name);
    await deps.store.setSecret('earn_agent_api_key', r.apiKey, 'Superteam Earn agent API key');
    await deps.store.setSecret('earn_agent_claim_code', r.claimCode, 'Superteam Earn claim code (give to the human operator only)');
    const identity: AgentIdentity = { agentId: r.agentId, userId: r.userId, name: r.name, username: r.username };
    await deps.store.setConfig('agent', { ...identity, registeredAt: nowOf(deps).toISOString() });
    deps.log?.(`registered agent ${identity.username}`);
    return { identity, created: true };
  } finally {
    await deps.store.unlock('register');
  }
}

async function priceBook(deps: Deps, symbols: string[]): Promise<PriceBook> {
  const now = nowOf(deps);
  const cached = (await deps.store.getConfig<PriceBook>('prices')) ?? {};
  const stale = symbols.filter((s) => !cached[s.toUpperCase()] || hoursSince(cached[s.toUpperCase()].at, now) > PRICE_TTL_H);
  if (!stale.length) return cached;
  let mints = (await deps.store.getConfig<{ at: string; map: Record<string, string> }>('token_mints')) ?? null;
  if (!mints || hoursSince(mints.at, now) > 24) {
    try {
      const { tokens } = await deps.earn.tokens();
      mints = { at: now.toISOString(), map: Object.fromEntries(tokens.map((t) => [t.tokenSymbol.toUpperCase(), t.mintAddress])) };
      await deps.store.setConfig('token_mints', mints);
    } catch {
      mints = mints ?? { at: now.toISOString(), map: {} };
    }
  }
  const fresh = await priceTokens(stale, mints.map, deps.fetchFn, now);
  const merged = { ...cached, ...fresh };
  await deps.store.setConfig('prices', merged);
  return merged;
}

/** Steps 2–4 — fetch live listings, read their terms, score them. */
export async function discover(deps: Deps) {
  const now = nowOf(deps);
  const settings = await getSettings(deps.store);
  const api = await authed(deps);
  const live = await api.liveListings();
  const prices = await priceBook(deps, [...new Set(live.map((l) => l.token).filter(Boolean) as string[])]);

  let detailsFetched = 0;
  let candidates = 0;
  const queue = [...live];
  const worker = async () => {
    for (let l = queue.shift(); l; l = queue.shift()) {
      const prev = await deps.store.getListing(l.id);
      let details: ListingDetails | null = prev?.details ?? null;
      let fetchedAt = prev?.details_fetched_at ?? null;
      const needsDetails = !details || hoursSince(fetchedAt, now) > DETAILS_TTL_H;
      if (needsDetails && detailsFetched < MAX_DETAILS_PER_TICK) {
        detailsFetched++;
        try {
          details = await api.details(l.slug);
          fetchedAt = now.toISOString();
        } catch (e) {
          deps.log?.(`details ${l.slug}: ${(e as Error).message}`);
        }
      }
      const tokenUsd = l.token ? prices[l.token.toUpperCase()]?.usd ?? null : null;
      const a = details
        ? assess({ live: l, details, tokenUsd, now, settings, allowedRegions: settings.allowedRegions })
        : null;
      if (a?.decision === 'candidate') candidates++;
      const job = await deps.store.getJobByListing(l.id);
      const jobDecision = job ? JOB_DECISION[job.status] : null;
      await deps.store.upsertListing({
        id: l.id,
        slug: l.slug,
        title: l.title,
        type: l.type,
        token: l.token ?? null,
        deadline: l.deadline ?? null,
        live: l,
        details,
        details_fetched_at: fetchedAt,
        assessment: a,
        score: a?.score ?? null,
        // Once a mission exists its state wins over a fresh score.
        decision: jobDecision ?? a?.decision ?? 'pending_details',
        decision_reason: job?.status === 'abandoned' ? `worker: ${job.last_error}` : a?.reason ?? 'details not fetched yet',
        is_live: true,
      });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const gone = await deps.store.markNotLive(live.map((l) => l.id));
  return { live: live.length, detailsFetched, candidates, noLongerLive: gone };
}

/** Step 4/5 — keep at most `maxActiveJobs` missions in flight, best score first. */
export async function enqueue(deps: Deps) {
  const now = nowOf(deps);
  const settings = await getSettings(deps.store);
  let expired = 0;
  for (const j of await deps.store.listJobs(ACTIVE_JOB_STATUSES)) {
    if (j.slug.startsWith(SELFTEST_PREFIX)) continue;
    const l = await deps.store.getListing(j.listing_id);
    const deadline = l?.deadline ? new Date(l.deadline).getTime() : 0;
    if (!l || deadline <= now.getTime() || !l.is_live) {
      await deps.store.updateJob(j.id, { status: 'expired', last_error: 'listing closed or deadline passed' });
      expired++;
    }
  }
  const active = await deps.store.listJobs(ACTIVE_JOB_STATUSES);
  const submitted24h = await deps.store.countSubmittedSince(new Date(now.getTime() - 86_400_000));
  const budget = Math.min(
    settings.maxActiveJobs - active.length,
    settings.dailySubmissionCap - submitted24h - active.length,
  );
  const queued: string[] = [];
  if (budget > 0) {
    const pool = (await deps.store.listListings(true))
      .filter((l) => l.decision === 'candidate' && (l.score ?? 0) >= settings.minScore)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    for (const l of pool) {
      if (queued.length >= budget) break;
      if (await deps.store.getJobByListing(l.id)) continue;
      await deps.store.createJob(l.id, l.slug, l.score ?? 0);
      await deps.store.upsertListing({ ...l, decision: 'selected' });
      queued.push(l.slug);
    }
  }
  return { expired, active: active.length + queued.length, queued, submitted24h };
}

function ledgerFor(l: ListingRow, job: JobRow, submittedAt: string, link: string): LedgerRow {
  const d = { ...l.live, ...(l.details ?? {}) } as ListingDetails;
  const { pool, firstPrize } = prizeStructure(d, d.rewardAmount);
  return {
    listing_id: l.id,
    slug: l.slug,
    title: l.title,
    submission_id: job.submission_id,
    submitted_at: submittedAt,
    link,
    token: l.token,
    prize_pool: pool || null,
    first_prize: firstPrize || null,
    expected_usd: l.assessment?.expectedUsd ?? null,
    outcome: 'pending',
    winner_position: null,
    amount_won: null,
    amount_won_usd: null,
    payout_status: null,
    checked_at: null,
  };
}

/** Steps 6–7 — pull finished deliverables from GitHub, gate them, submit. */
export async function ingest(deps: Deps) {
  const now = nowOf(deps);
  const settings = await getSettings(deps.store);
  const jobs = (await deps.store.listJobs(['queued', 'rejected_qa', 'delivered', 'submit_failed'])).filter(
    (j) => j.status !== 'submit_failed' || j.attempts < MAX_SUBMIT_ATTEMPTS,
  );
  const out = { checked: jobs.length, abandoned: 0, rejected: 0, submitted: 0, approved: 0, waiting: 0, failed: 0, sha: '' };
  if (!jobs.length) return out;
  const sha = await deps.github.headSha();
  out.sha = sha;
  const api = await authed(deps);

  for (const job of jobs) {
    const raw = await deps.github.readFile(sha, `deliverables/${job.slug}/submission.json`);
    if (raw == null) {
      out.waiting++;
      continue;
    }
    let manifest: Manifest;
    try {
      manifest = JSON.parse(raw);
    } catch (e) {
      await deps.store.updateJob(job.id, { status: 'rejected_qa', last_error: `submission.json is not valid JSON: ${(e as Error).message}` });
      out.rejected++;
      continue;
    }
    const primaryPath = `deliverables/${job.slug}/${manifest.primaryFile ?? 'README.md'}`;
    const primaryText = manifest.status === 'ready' ? await deps.github.readFile(sha, primaryPath) : null;
    const hash = await sha256Hex(`${raw}\n${primaryText ?? ''}`);
    // Nothing changed since the gate last refused it: wait for the worker.
    if (hash === job.manifest_hash && (job.status === 'rejected_qa' || job.status === 'submit_failed')) {
      out.waiting++;
      continue;
    }

    if (manifest.status === 'abandoned') {
      const reason = (manifest.abandonReason ?? 'no reason given').slice(0, 500);
      await deps.store.updateJob(job.id, { status: 'abandoned', manifest_hash: hash, commit_sha: sha, last_error: reason });
      const l = await deps.store.getListing(job.listing_id);
      if (l) await deps.store.upsertListing({ ...l, decision: 'abandoned', decision_reason: `worker: ${reason}` });
      out.abandoned++;
      continue;
    }

    const selftest = job.slug.startsWith(SELFTEST_PREFIX);
    let details: ListingDetails;
    try {
      // Re-read: terms or status may have changed since selection.
      details = selftest ? (await deps.store.getListing(job.listing_id))!.details! : await api.details(job.slug);
    } catch (e) {
      await deps.store.updateJob(job.id, { last_error: `could not re-read listing: ${(e as Error).message}` });
      out.waiting++;
      continue;
    }
    const qa = validateManifest(manifest, { details, jobSlug: job.slug, settings, sha, primaryText, now });
    if (!qa.ok || !qa.payload) {
      await deps.store.updateJob(job.id, {
        status: 'rejected_qa',
        manifest_hash: hash,
        commit_sha: sha,
        qa_report: { errors: qa.errors, warnings: qa.warnings, at: now.toISOString() },
        last_error: qa.errors.join(' | ').slice(0, 1000),
      });
      out.rejected++;
      continue;
    }
    if (!(await deps.github.isPublic(qa.link!))) {
      await deps.store.updateJob(job.id, { status: 'delivered', last_error: `deliverable link not reachable yet: ${qa.link}` });
      out.waiting++;
      continue;
    }
    const base = {
      manifest_hash: hash,
      commit_sha: sha,
      deliverable_url: qa.link,
      delivered_at: job.delivered_at ?? now.toISOString(),
      qa_report: { errors: [], warnings: qa.warnings, at: now.toISOString() },
    };
    if (!settings.autoSubmit || selftest) {
      await deps.store.updateJob(job.id, {
        ...base,
        status: 'approved',
        submission_response: selftest ? { selftest: true, wouldSubmit: qa.payload } : null,
        last_error: null,
      });
      out.approved++;
      continue;
    }
    const submitted24h = await deps.store.countSubmittedSince(new Date(now.getTime() - 86_400_000));
    if (submitted24h >= settings.dailySubmissionCap) {
      await deps.store.updateJob(job.id, { ...base, status: 'delivered', last_error: 'daily submission cap reached' });
      out.waiting++;
      continue;
    }
    try {
      const res = await api.submit(qa.payload);
      const submittedAt = now.toISOString();
      const updated = { ...job, ...base, submission_id: String(res.id ?? ''), submitted_at: submittedAt };
      await deps.store.updateJob(job.id, {
        ...base,
        status: 'submitted',
        submitted_at: submittedAt,
        submission_id: updated.submission_id,
        submission_response: res,
        attempts: job.attempts + 1,
        last_error: null,
      });
      const l = await deps.store.getListing(job.listing_id);
      if (l) {
        await deps.store.upsertLedger(ledgerFor(l, updated, submittedAt, qa.link!));
        await deps.store.upsertListing({ ...l, decision: 'submitted' });
      }
      out.submitted++;
    } catch (e) {
      const status = e instanceof EarnApiError ? e.status : 0;
      const transient = status === 429 || status >= 500 || status === 0;
      await deps.store.updateJob(job.id, {
        ...base,
        status: transient ? 'delivered' : 'submit_failed',
        attempts: job.attempts + 1,
        submission_response: e instanceof EarnApiError ? e.body : null,
        last_error: (e as Error).message.slice(0, 1000),
      });
      out.failed++;
    }
  }
  return out;
}

/** Step 8 — follow results; winnings stay "awaiting claim" until the human claims. */
export async function track(deps: Deps) {
  const now = nowOf(deps);
  const out = { checked: 0, won: 0, lost: 0 };
  const pending = (await deps.store.listLedger()).filter((r) => r.outcome === 'pending' && hoursSince(r.checked_at, now) >= TRACK_EVERY_H);
  if (!pending.length) return out;
  const api = await authed(deps);
  const identity = await deps.store.getConfig<AgentIdentity>('agent');
  let claimedBy: string | null = null;
  try {
    const st = await api.status();
    claimedBy = st.claimedByUserId ?? null;
    await deps.store.setConfig('agent_status', { ...st, at: now.toISOString() });
  } catch {
    claimedBy = (await deps.store.getConfig<{ claimedByUserId?: string }>('agent_status'))?.claimedByUserId ?? null;
  }
  const ours = new Set([identity?.userId, claimedBy].filter(Boolean) as string[]);
  const prices = (await deps.store.getConfig<PriceBook>('prices')) ?? {};

  for (const row of pending) {
    out.checked++;
    try {
      const d = await api.details(row.slug);
      if (!d.isWinnersAnnounced) {
        await deps.store.upsertLedger({ ...row, checked_at: now.toISOString() });
        continue;
      }
      const winners = await deps.earn.winners(row.listing_id);
      const mine = winners.find((w) => w.user?.id && ours.has(w.user.id));
      if (!mine) {
        await deps.store.upsertLedger({ ...row, outcome: 'lost', checked_at: now.toISOString() });
        out.lost++;
        continue;
      }
      const pos = mine.winnerPosition ?? null;
      const amount = pos != null ? d.rewards?.[String(pos)] ?? null : null;
      const usd = amount != null && row.token ? prices[row.token.toUpperCase()]?.usd ?? null : null;
      await deps.store.upsertLedger({
        ...row,
        outcome: 'won',
        winner_position: pos,
        amount_won: amount,
        amount_won_usd: usd != null && amount != null ? amount * usd : null,
        payout_status: claimedBy ? 'claimed: payout handled by Earn after sponsor payment' : 'awaiting human claim (claim code in Supabase Vault)',
        checked_at: now.toISOString(),
      });
      out.won++;
    } catch (e) {
      const notFound = e instanceof EarnApiError && e.status === 404;
      await deps.store.upsertLedger({ ...row, outcome: notFound ? 'unknown' : row.outcome, checked_at: now.toISOString() });
    }
  }
  return out;
}

async function step<T>(name: string, errors: string[], fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    errors.push(`${name}: ${(e as Error).message}`);
    return null;
  }
}

/** Step 9 — the 30-minute cycle run by pg_cron. */
export async function tick(deps: Deps, kind = 'tick') {
  if (!(await deps.store.tryLock('tick', 240))) return { skipped: 'another run holds the lock' };
  const runId = await deps.store.startRun(kind);
  const errors: string[] = [];
  const stats: Record<string, unknown> = {};
  try {
    stats.registration = await step('register', errors, async () => (await ensureRegistered(deps)).created);
    if (kind === 'tick') {
      stats.discover = await step('discover', errors, () => discover(deps));
      stats.enqueue = await step('enqueue', errors, () => enqueue(deps));
    }
    stats.ingest = await step('ingest', errors, () => ingest(deps));
    if (kind === 'tick') stats.track = await step('track', errors, () => track(deps));
    if (kind === 'ingest') stats.enqueue = await step('enqueue', errors, () => enqueue(deps));
    await deps.store.finishRun(runId, errors.length === 0, stats, errors.join(' | ') || null);
    return { runId, ok: errors.length === 0, stats, errors };
  } finally {
    await deps.store.unlock('tick');
  }
}

/** Work order for the AI worker (published to the workspace branch). */
export async function buildQueue(deps: Deps) {
  const now = nowOf(deps);
  const settings = await getSettings(deps.store);
  const jobs = await deps.store.listJobs(['queued', 'rejected_qa', 'submit_failed', 'delivered']);
  const items = [];
  for (const j of jobs) {
    const l = await deps.store.getListing(j.listing_id);
    if (!l?.details) continue;
    const d = l.details;
    items.push({
      jobId: j.id,
      status: j.status,
      listingId: l.id,
      slug: l.slug,
      title: l.title,
      type: l.type,
      url: `https://superteam.fun/earn/listing/${l.slug}`,
      deadline: l.deadline,
      token: l.token,
      rewards: d.rewards ?? null,
      rewardAmount: d.rewardAmount ?? null,
      maxBonusSpots: d.maxBonusSpots ?? 0,
      agentAccess: d.agentAccess,
      compensationType: d.compensationType,
      sponsor: d.sponsor ?? null,
      skills: d.skills ?? [],
      eligibility: d.eligibility ?? [],
      descriptionText: htmlToText(d.description),
      requirementsText: htmlToText(d.requirements),
      descriptionHtml: d.description ?? '',
      assessment: l.assessment,
      previousAttempt:
        j.status === 'queued'
          ? null
          : { status: j.status, error: j.last_error, qaReport: j.qa_report, commit: j.commit_sha, submissionResponse: j.submission_response },
    });
  }
  return {
    generatedAt: now.toISOString(),
    version: VERSION,
    workspace: { owner: settings.repoOwner, repo: settings.repoName, branch: settings.branch },
    rules: {
      minQaScore: settings.minQaScore,
      maxConcurrent: settings.maxActiveJobs,
      linkAnswersMustPointTo: `https://github.com/${settings.repoOwner}/${settings.repoName}/`,
    },
    jobs: items.sort((a, b) => (b.assessment?.score ?? 0) - (a.assessment?.score ?? 0)),
  };
}

/** Public, secret-free status: agent profile, pipeline, ledger, heartbeat. */
export async function buildStatus(deps: Deps) {
  const now = nowOf(deps);
  const settings = await getSettings(deps.store);
  const identity = await deps.store.getConfig<AgentIdentity & { registeredAt?: string }>('agent');
  const agentStatus = await deps.store.getConfig<{ claimedByUserId?: string | null; status?: string }>('agent_status');
  const listings = await deps.store.listListings(false);
  const live = listings.filter((l) => l.is_live);
  const jobs = await deps.store.listJobs();
  const ledger = await deps.store.listLedger();
  const runs = await deps.store.recentRuns(10);
  const prices = (await deps.store.getConfig<PriceBook>('prices')) ?? {};

  const countBy = <T>(xs: T[], k: (x: T) => string) =>
    xs.reduce<Record<string, number>>((acc, x) => ((acc[k(x)] = (acc[k(x)] ?? 0) + 1), acc), {});
  const usd = (amount: number | null, token: string | null) =>
    amount != null && token && prices[token.toUpperCase()] ? amount * prices[token.toUpperCase()].usd : null;

  const won = ledger.filter((r) => r.outcome === 'won');
  const pending = ledger.filter((r) => r.outcome === 'pending');
  const lastRun = runs[0] ?? null;
  const totals = {
    submissions: ledger.length,
    pendingResults: pending.length,
    pendingMaxUsd: pending.reduce((s, r) => s + (usd(r.first_prize, r.token) ?? 0), 0),
    pendingExpectedUsd: pending.reduce((s, r) => s + (r.expected_usd ?? 0), 0),
    won: won.length,
    wonUsd: won.reduce((s, r) => s + (r.amount_won_usd ?? 0), 0),
    wonByToken: won.reduce<Record<string, number>>((acc, r) => {
      if (r.token && r.amount_won != null) acc[r.token] = (acc[r.token] ?? 0) + r.amount_won;
      return acc;
    }, {}),
    awaitingClaim: won.filter((r) => (r.payout_status ?? '').startsWith('awaiting')).length,
    lost: ledger.filter((r) => r.outcome === 'lost').length,
  };

  return {
    generatedAt: now.toISOString(),
    version: VERSION,
    heartbeat: {
      status: !identity ? 'blocked' : lastRun && lastRun.ok === false ? 'degraded' : 'ok',
      agentName: identity?.name ?? AGENT_NAME,
      time: now.toISOString(),
      version: VERSION,
      capabilities: ['register', 'listings', 'submit', 'claim'],
      lastAction: lastRun ? `${lastRun.kind} run #${lastRun.id} ${lastRun.ok ? 'ok' : `with errors: ${lastRun.error ?? ''}`}` : 'none yet',
      nextAction: 'next discovery cycle within 30 minutes',
    },
    agent: identity
      ? {
          name: identity.name,
          username: identity.username,
          agentId: identity.agentId,
          profileUrl: `https://superteam.fun/earn/t/${identity.username}`,
          registeredAt: identity.registeredAt ?? null,
          claimed: Boolean(agentStatus?.claimedByUserId),
        }
      : null,
    settings: { ...settings, telegramUrl: settings.telegramUrl ? 'configured' : null },
    pipeline: {
      liveListings: live.length,
      decisions: countBy(live, (l) => l.decision ?? 'unknown'),
      jobs: countBy(jobs, (j) => j.status),
      topCandidates: live
        .filter((l) => l.assessment)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 15)
        .map((l) => ({
          slug: l.slug,
          title: l.title,
          type: l.type,
          token: l.token,
          deadline: l.deadline,
          category: l.assessment!.category,
          score: Number((l.score ?? 0).toFixed(3)),
          expectedUsd: Number(l.assessment!.expectedUsd.toFixed(2)),
          decision: l.decision,
          reason: l.decision_reason,
        })),
    },
    jobs: jobs.map((j) => ({
      slug: j.slug,
      status: j.status,
      queuedAt: j.queued_at,
      submittedAt: j.submitted_at,
      link: j.deliverable_url,
      lastError: j.last_error,
    })),
    ledger,
    totals,
    runs: runs.map((r) => ({ id: r.id, kind: r.kind, startedAt: r.started_at, ok: r.ok, error: r.error, stats: r.stats })),
  };
}

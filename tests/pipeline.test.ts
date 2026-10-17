import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EarnClient } from '../supabase/functions/earn-agent/lib/earn.ts';
import { GitHubWorkspace } from '../supabase/functions/earn-agent/lib/github.ts';
import { buildQueue, buildStatus, tick, type Deps } from '../supabase/functions/earn-agent/lib/pipeline.ts';
import { goodManifest, hackathonListing, MemoryStore, mockFetch, NOW, projectListing, writingListing, type MockEarnState } from './helpers.ts';

function setup() {
  let now = NOW;
  const state: MockEarnState = {
    listings: [writingListing(), hackathonListing(), projectListing()],
    submissions: [],
    winners: {},
    registerCalls: 0,
    authHeaders: [],
  };
  const repo = { headSha: 'b'.repeat(40), files: {} as Record<string, string> };
  const fetchFn = mockFetch(state, repo);
  const store = new MemoryStore(() => now);
  const deps: Deps = {
    store,
    earn: new EarnClient(null, 'https://superteam.fun', fetchFn),
    github: new GitHubWorkspace('mathieumilo3-bot', '-generation-capable', 'earn-agent', fetchFn),
    fetchFn,
    now: () => now,
  };
  const advance = (hours: number) => {
    now = new Date(now.getTime() + hours * 3_600_000);
  };
  return { state, repo, store, deps, advance };
}

function deliver(repo: { headSha: string; files: Record<string, string> }, slug: string, manifest: object) {
  repo.headSha = (parseInt(repo.headSha.slice(0, 8), 16) + 1).toString(16).padStart(8, '0') + 'c'.repeat(32);
  repo.files[`deliverables/${slug}/submission.json`] = JSON.stringify(manifest);
  repo.files[`deliverables/${slug}/README.md`] = '# Solana Actions for developers\n\n' + 'Actions expose a GET metadata route and a POST transaction route. '.repeat(40);
}

test('full cycle: register, select, wait, gate, submit, track a win', async () => {
  const { state, repo, store, deps, advance } = setup();
  await store.setConfig('settings', { relaxedBlockers: [] });

  const first = await tick(deps);
  assert.equal((first as { ok: boolean }).ok, true, JSON.stringify(first));
  assert.equal(state.registerCalls, 1);
  assert.equal(store.secrets.get('earn_agent_api_key'), 'sk_test_secret_key_123456');
  assert.equal(store.secrets.get('earn_agent_claim_code'), 'CLAIM-SECRET');

  // Only the writing bounty is doable; hackathon and project are skipped with reasons.
  const jobs = await store.listJobs();
  assert.deepEqual(jobs.map((j) => j.slug), [writingListing().slug]);
  assert.equal((await store.getListing('lst-hack'))!.decision, 'skip');
  assert.equal((await store.getListing('lst-project'))!.decision, 'skip');

  // Work order for the AI worker carries the full brief, and nothing secret.
  const queue = await buildQueue(deps);
  assert.equal(queue.jobs.length, 1);
  assert.match(queue.jobs[0].descriptionText, /in-depth article/);
  assert.equal(queue.jobs[0].eligibility.length, 3);
  const status = await buildStatus(deps);
  const publicText = JSON.stringify({ queue, status });
  assert.ok(!publicText.includes('sk_test_secret_key_123456'));
  assert.ok(!publicText.includes('CLAIM-SECRET'));
  assert.equal(status.agent!.username, 'generationcapable-x1');

  // Second tick: no deliverable yet -> waits, does not re-register, no duplicate job.
  advance(0.5);
  await tick(deps);
  assert.equal(state.registerCalls, 1);
  assert.equal((await store.listJobs()).length, 1);
  assert.equal(state.submissions.length, 0);

  // Worker pushes a deliverable that fails the gate (missing answer).
  deliver(repo, writingListing().slug, goodManifest({ eligibilityAnswers: [] }));
  await tick(deps, 'ingest');
  let job = (await store.listJobs())[0];
  assert.equal(job.status, 'rejected_qa');
  assert.match(job.last_error!, /Title of your article/);
  assert.equal((await buildQueue(deps)).jobs[0].previousAttempt!.status, 'rejected_qa');

  // Unchanged files are not re-evaluated.
  await tick(deps, 'ingest');
  assert.equal(state.submissions.length, 0);

  // Worker fixes it -> submitted through the official API with the pinned link.
  const fixed = goodManifest();
  fixed.eligibilityAnswers![1].answer = `https://github.com/mathieumilo3-bot/-generation-capable/tree/${'d'.repeat(40)}/deliverables/${writingListing().slug}`;
  deliver(repo, writingListing().slug, fixed);
  await tick(deps, 'ingest');
  job = (await store.listJobs())[0];
  assert.equal(job.status, 'submitted', job.last_error ?? '');
  assert.equal(state.submissions.length, 1);
  const sent = state.submissions[0] as { listingId: string; link: string; tweet: string };
  assert.equal(sent.listingId, 'lst-writing');
  assert.equal(sent.tweet, '');
  assert.equal(sent.link, `https://github.com/mathieumilo3-bot/-generation-capable/blob/${repo.headSha}/deliverables/${writingListing().slug}/README.md`);
  assert.ok(state.authHeaders.every((h) => h === 'Bearer sk_test_secret_key_123456'));

  const ledger = await store.listLedger();
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].outcome, 'pending');
  assert.equal(ledger[0].first_prize, 500);

  // Winners announced with our agent in 2nd place -> recorded as won, awaiting claim.
  state.listings[0] = { ...state.listings[0], isWinnersAnnounced: true, status: 'CLOSED' };
  state.winners['lst-writing'] = [
    { id: 's1', winnerPosition: 1, user: { id: 'someone-else', username: 'human' } },
    { id: 's2', winnerPosition: 2, user: { id: 'user-agent-1', username: 'generationcapable-x1' } },
  ];
  advance(7);
  await tick(deps);
  const row = (await store.listLedger())[0];
  assert.equal(row.outcome, 'won');
  assert.equal(row.winner_position, 2);
  assert.equal(row.amount_won, 300);
  assert.equal(row.amount_won_usd, 300);
  assert.match(row.payout_status!, /awaiting human claim/);
  const totals = (await buildStatus(deps)).totals;
  assert.equal(totals.wonUsd, 300);
  assert.equal(totals.awaitingClaim, 1);
});

test('abandoned missions free their slot and are never retried', async () => {
  const { repo, store, deps, state } = setup();
  await store.setConfig('settings', { relaxedBlockers: [] });
  state.listings.push(writingListing({ id: 'lst-b', slug: 'second-guide', title: 'Write a guide to compressed NFTs' }));
  await tick(deps);
  assert.equal((await store.listJobs()).length, 2);
  repo.headSha = 'e'.repeat(40);
  repo.files['deliverables/second-guide/submission.json'] = JSON.stringify({
    version: 1,
    listingId: 'lst-b',
    slug: 'second-guide',
    status: 'abandoned',
    abandonReason: 'Requires publishing on X from an account we do not own.',
  });
  await tick(deps, 'ingest');
  const b = (await store.listJobs()).find((j) => j.slug === 'second-guide')!;
  assert.equal(b.status, 'abandoned');
  assert.equal((await store.getListing('lst-b'))!.decision, 'abandoned');
  await tick(deps);
  assert.equal((await store.getListing('lst-b'))!.decision, 'abandoned');
  assert.equal((await store.listJobs(['queued'])).length, 1);
});

test('caps concurrent missions at five and retries transient submit errors', async () => {
  const { repo, store, deps, state } = setup();
  for (let i = 0; i < 8; i++) {
    state.listings.push(writingListing({ id: `lst-${i}`, slug: `guide-${i}`, title: `Write guide number ${i}` }));
  }
  await tick(deps);
  assert.equal((await store.listJobs(['queued'])).length, 5);

  // No sixth mission even after another discovery cycle.
  await tick(deps);
  assert.equal((await store.listJobs()).length, 5);

  const job = (await store.listJobs())[0];
  deliver(repo, job.slug, goodManifest({
    listingId: job.listing_id,
    slug: job.slug,
    eligibilityAnswers: [
      { question: 'Title of your article', answer: 'Guide' },
      { question: 'Link to the code samples', answer: `https://github.com/mathieumilo3-bot/-generation-capable/tree/x/deliverables/${job.slug}` },
    ],
  }));
  state.submitStatus = 429;
  await tick(deps, 'ingest');
  const afterLimit = (await store.listJobs()).find((j) => j.id === job.id)!;
  assert.equal(afterLimit.status, 'delivered');
  assert.match(afterLimit.last_error!, /429/);
  state.submitStatus = undefined;
  await tick(deps, 'ingest');
  assert.equal((await store.listJobs()).find((j) => j.id === job.id)!.status, 'submitted');
  assert.equal(state.submissions.length, 1);

  // A rejection (4xx) is not retried with the same files.
  const other = (await store.listJobs(['queued']))[0];
  deliver(repo, other.slug, goodManifest({
    listingId: other.listing_id,
    slug: other.slug,
    eligibilityAnswers: [
      { question: 'Title of your article', answer: 'Guide' },
      { question: 'Link to the code samples', answer: `https://github.com/mathieumilo3-bot/-generation-capable/tree/x/deliverables/${other.slug}` },
    ],
  }));
  state.submitStatus = 403;
  await tick(deps, 'ingest');
  assert.equal((await store.listJobs()).find((j) => j.id === other.id)!.status, 'submit_failed');
  state.submitStatus = undefined;
  await tick(deps, 'ingest');
  assert.equal((await store.listJobs()).find((j) => j.id === other.id)!.status, 'submit_failed');
  assert.equal(state.submissions.length, 1);
});

test('stops cleanly when the API key is rejected', async () => {
  const { deps, store } = setup();
  await store.setConfig('agent', { agentId: 'a', userId: 'u', name: 'n', username: 'x' });
  await store.setSecret('earn_agent_api_key', 'sk_wrong', '');
  const r = (await tick(deps)) as { ok: boolean; errors: string[] };
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('401')));
  assert.equal((await buildStatus(deps)).heartbeat.status, 'degraded');
});

test('selftest jobs run the whole gate but are never submitted nor expired', async () => {
  const { repo, store, deps, state } = setup();
  state.listings = [];
  await tick(deps);
  const details = writingListing({ id: 'selftest-1', slug: 'selftest-bridge-check' });
  await store.upsertListing({
    id: details.id, slug: details.slug, title: details.title, type: 'bounty', token: 'USDC', deadline: details.deadline!,
    live: details, details, details_fetched_at: NOW.toISOString(), assessment: null, score: 0,
    decision: 'selected', decision_reason: 'selftest', is_live: false,
  });
  const job = await store.createJob(details.id, details.slug, 0);
  await tick(deps);
  assert.equal((await store.listJobs())[0].status, 'queued');
  deliver(repo, details.slug, goodManifest({
    listingId: details.id,
    slug: details.slug,
    eligibilityAnswers: [
      { question: 'Title of your article', answer: 'Bridge check' },
      { question: 'Link to the code samples', answer: `https://github.com/mathieumilo3-bot/-generation-capable/tree/earn-agent/deliverables/${details.slug}` },
    ],
  }));
  await tick(deps, 'ingest');
  const done = (await store.listJobs()).find((j) => j.id === job.id)!;
  assert.equal(done.status, 'approved', done.last_error ?? '');
  assert.equal(state.submissions.length, 0);
  assert.equal((done.submission_response as { selftest: boolean }).selftest, true);
});

test('relaxed blockers let the worker judge hackathon tracks', async () => {
  const { store, deps } = setup();
  await tick(deps);
  assert.equal((await store.getListing('lst-hack'))!.decision, 'selected');
  assert.equal((await store.getListing('lst-project'))!.decision, 'skip');
});

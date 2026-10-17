import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess, classify, detectBlockers, prizeStructure } from '../supabase/functions/earn-agent/lib/scoring.ts';
import { hackathonListing, NOW, projectListing, writingListing } from './helpers.ts';

const settings = { minScore: 1, minHoursLeft: 4 };

test('classifies writing, translation and code listings', () => {
  assert.equal(classify(writingListing()), 'writing');
  assert.equal(
    classify(writingListing({ title: 'Translate the Jupiter docs into French', skills: [{ skills: 'Content', subskills: ['Writing'] }] })),
    'translation',
  );
  assert.equal(
    classify(
      writingListing({
        title: 'Build a TypeScript SDK for our API',
        description: '<p>Implement an open-source SDK with tests.</p>',
        skills: [{ skills: 'Backend', subskills: ['Typescript'] }],
      }),
    ),
    'code',
  );
  assert.equal(
    classify(writingListing({ title: 'Dune dashboard for protocol metrics', description: '<p>Build a Dune dashboard</p>', skills: [{ skills: 'Other', subskills: ['Data Analytics'] }] })),
    'data',
  );
});

test('hard-blocks work an AI agent cannot do honestly', () => {
  const h = assess({ live: hackathonListing(), details: hackathonListing(), tokenUsd: 1, now: NOW, settings });
  assert.equal(h.decision, 'skip');
  assert.match(h.reason, /hackathon/);
  // Relaxed by settings: the worker reads it and decides.
  const relaxed = assess({ live: hackathonListing(), details: hackathonListing(), tokenUsd: 1, now: NOW, settings, relaxedBlockers: ['hackathon_track'] });
  assert.equal(relaxed.decision, 'candidate');
  assert.ok(relaxed.softBlockers.some((b) => b.startsWith('hackathon_track')));

  const p = assess({ live: projectListing(), details: projectListing(), tokenUsd: 1, now: NOW, settings });
  assert.equal(p.decision, 'skip');
  assert.match(p.reason, /project_gig/);

  const thread = writingListing({ title: 'Write a Twitter thread about our launch' });
  assert.match(assess({ live: thread, details: thread, tokenUsd: 1, now: NOW, settings }).reason, /x_post_required/);

  const social = writingListing({ eligibility: [{ question: 'Your X handle', type: 'text' }] });
  assert.ok(detectBlockers(social, 'writing', []).hard.some((b) => b.startsWith('personal_account')));

  const optionalSocial = writingListing({ eligibility: [{ question: 'Your X handle', type: 'text', optional: true }] });
  assert.ok(!detectBlockers(optionalSocial, 'writing', []).hard.some((b) => b.startsWith('personal_account')));

  const regional = writingListing({ region: 'India' });
  assert.ok(detectBlockers(regional, 'writing', ['France']).hard.some((b) => b.startsWith('regional')));
  assert.equal(detectBlockers(writingListing({ region: 'France' }), 'writing', ['France']).hard.length, 0);

  const event = writingListing({ description: '<p>Host a meetup in your city and write a recap.</p>' });
  assert.ok(detectBlockers(event, 'writing', []).hard.includes('physical_presence'));

  const spend = writingListing({ description: '<p>You must swap at least 1 SOL on our DEX and write about it.</p>' });
  assert.ok(detectBlockers(spend, 'writing', []).hard.some((b) => b.startsWith('onchain_spending')));
});

test('skips listings whose deadline is too close or token is unpriced', () => {
  const soon = writingListing({ deadline: new Date(NOW.getTime() + 2 * 3_600_000).toISOString() });
  assert.match(assess({ live: soon, details: soon, tokenUsd: 1, now: NOW, settings }).reason, /deadline_too_close/);
  const sol = writingListing({ token: 'WEIRD' });
  assert.match(assess({ live: sol, details: sol, tokenUsd: null, now: NOW, settings }).reason, /no USD price/);
});

test('expected value grows with prize, shrinks with competition', () => {
  const base = writingListing();
  const a = assess({ live: base, details: base, tokenUsd: 1, now: NOW, settings });
  assert.equal(a.decision, 'candidate');
  assert.equal(a.category, 'writing');
  assert.equal(a.winners, 3);
  assert.ok(a.expectedUsd > 0 && a.expectedUsd < 1000);

  const crowded = writingListing({ _count: { Submission: 120 } });
  const b = assess({ live: crowded, details: crowded, tokenUsd: 1, now: NOW, settings });
  assert.ok(b.winProbability < a.winProbability);

  const humans = writingListing({ agentAccess: 'AGENT_ALLOWED' });
  assert.ok(assess({ live: humans, details: humans, tokenUsd: 1, now: NOW, settings }).winProbability < a.winProbability);

  const sol = assess({ live: base, details: base, tokenUsd: 150, now: NOW, settings });
  assert.ok(Math.abs(sol.expectedUsd - a.expectedUsd * 150) < 1e-6);
});

test('prize structure counts bonus spots', () => {
  const s = prizeStructure({ rewards: { '1': 300, '2': 200, '99': 50 }, maxBonusSpots: 4 }, null);
  assert.deepEqual(s, { pool: 700, winners: 6, firstPrize: 300 });
  assert.deepEqual(prizeStructure({ rewards: null }, 400), { pool: 400, winners: 1, firstPrize: 400 });
});

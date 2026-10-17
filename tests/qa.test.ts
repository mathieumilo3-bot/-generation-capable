import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EARN_URL_REGEX, validateManifest } from '../supabase/functions/earn-agent/lib/qa.ts';
import { DEFAULT_SETTINGS } from '../supabase/functions/earn-agent/lib/types.ts';
import { goodManifest, NOW, REPO, SHA, slug, writingListing } from './helpers.ts';

const ctx = (over = {}) => ({
  details: writingListing(),
  jobSlug: slug,
  settings: DEFAULT_SETTINGS,
  sha: SHA,
  primaryText: '# Guide\n\n' + 'Solana Actions turn any API into a signable transaction. '.repeat(40),
  now: NOW,
  ...over,
});

test('accepts a complete deliverable and builds the official payload', () => {
  const r = validateManifest(goodManifest(), ctx());
  assert.deepEqual(r.errors, []);
  assert.ok(r.ok);
  assert.equal(r.link, `${REPO}/blob/${SHA}/deliverables/${slug}/README.md`);
  assert.ok(EARN_URL_REGEX.test(r.link!));
  assert.equal(r.payload!.tweet, '');
  assert.equal(r.payload!.ask, null);
  assert.equal(r.payload!.eligibilityAnswers.length, 3);
  assert.equal(r.payload!.eligibilityAnswers[2].answer, '');
  assert.match(r.payload!.otherInfo, /^<p>A 1,800-word/);
  assert.ok(!validateManifest(goodManifest({ otherInfo: 'A long explanation of the guide without any disclosure of who wrote it at all, which is not ok.' }), ctx()).ok);
  assert.match(r.payload!.otherInfo, /<ul><li>Explains the Actions spec<\/li>/);
  assert.equal('telegram' in r.payload!, false);
});

test('refuses missing required answers and links we do not control', () => {
  const missing = validateManifest(goodManifest({ eligibilityAnswers: [] }), ctx());
  assert.ok(!missing.ok);
  assert.ok(missing.errors.some((e) => e.includes('Title of your article')));

  const foreign = validateManifest(
    goodManifest({
      eligibilityAnswers: [
        { question: 'Title of your article', answer: 'x' },
        { question: 'Link to the code samples', answer: 'https://medium.com/@someone/post' },
      ],
    }),
    ctx(),
  );
  assert.ok(foreign.errors.some((e) => e.includes('links outside our deliverables')));
});

test('refuses placeholders, secrets, weak reviews and closed listings', () => {
  assert.ok(!validateManifest(goodManifest(), ctx({ primaryText: 'Intro\n\nTODO: finish this section. ' + 'x'.repeat(700) })).ok);
  assert.ok(!validateManifest(goodManifest(), ctx({ primaryText: 'key sk_live_abcdefghijklmnop ' + 'x'.repeat(700) })).ok);
  assert.ok(!validateManifest(goodManifest(), ctx({ primaryText: null })).ok);
  assert.ok(!validateManifest(goodManifest({ qa: { ...goodManifest().qa, score: 6 } }), ctx()).ok);
  assert.ok(!validateManifest(goodManifest({ qa: { ...goodManifest().qa, reviewer: 'self' } }), ctx()).ok);
  assert.ok(
    !validateManifest(goodManifest({ qa: { ...goodManifest().qa, checklist: [{ requirement: 'code samples', met: false }] } }), ctx()).ok,
  );
  assert.ok(!validateManifest(goodManifest(), ctx({ details: writingListing({ status: 'REVIEW' }) })).ok);
  assert.ok(!validateManifest(goodManifest(), ctx({ details: writingListing({ agentAccess: 'HUMAN_ONLY' }) })).ok);
  assert.ok(!validateManifest(goodManifest({ primaryFile: '../../etc/passwd' }), ctx()).ok);
  assert.ok(!validateManifest(goodManifest({ listingId: 'other' }), ctx()).ok);
});

test('project listings need the operator Telegram and an in-range ask', () => {
  const details = writingListing({ type: 'project', compensationType: 'range', minRewardAsk: 500, maxRewardAsk: 1500 });
  const noTg = validateManifest(goodManifest({ ask: 800 }), ctx({ details }));
  assert.ok(noTg.errors.some((e) => e.includes('Telegram')));
  const settings = { ...DEFAULT_SETTINGS, telegramUrl: 'http://t.me/operator_handle' };
  const outOfRange = validateManifest(goodManifest({ ask: 5000 }), ctx({ details, settings }));
  assert.ok(outOfRange.errors.some((e) => e.includes('outside')));
  const ok = validateManifest(goodManifest({ ask: 800 }), ctx({ details, settings }));
  assert.ok(ok.ok, ok.errors.join());
  assert.equal(ok.payload!.ask, 800);
  assert.equal(ok.payload!.telegram, 'http://t.me/operator_handle');
});

import type { Assessment, Category, ListingDetails, LiveListing, Settings } from './types.ts';
import { htmlToText } from './text.ts';

/** Categories the operator asked to prioritise. */
export const PREFERRED: ReadonlySet<Category> = new Set([
  'writing',
  'translation',
  'content',
  'research',
  'code',
  'data',
]);

/**
 * How competitive an AI-produced deliverable is against human entries, per
 * category. Deliberately conservative: it only ranks listings, it is not a
 * promise of results.
 */
const AI_COMPETITIVENESS: Record<Category, number> = {
  translation: 0.9,
  writing: 0.6,
  research: 0.6,
  data: 0.55,
  code: 0.5,
  content: 0.45,
  growth: 0.3,
  other: 0.3,
  design: 0.1,
  video: 0.05,
  community: 0.05,
};

/** Rough effort (hours of focused work) to produce a winning-grade entry. */
const BASE_HOURS: Record<Category, number> = {
  translation: 2,
  writing: 3,
  content: 3,
  research: 4,
  data: 4,
  code: 6,
  growth: 4,
  other: 4,
  design: 6,
  video: 8,
  community: 10,
};

const CATEGORY_KEYWORDS: [Category, RegExp][] = [
  ['translation', /\b(translat\w*|locali[sz]\w*|traduction|traduire)\b/],
  ['video', /\b(video|youtube|tiktok|reels?|vlog|animation|podcast)\b/],
  ['design', /\b(design|figma|logo|illustration|meme|banner|graphic|mockup|ui\/ux|nft art)\b/],
  ['code', /\b(build|develop|developing|development|implement\w*|sdk|api|bot|script|smart contract|program|github|repo|typescript|rust|anchor|frontend|backend|cli|plugin|integration|open[- ]source)\b/],
  ['data', /\b(dashboard|dune|data ?set|data analysis|analytics|scrap\w*|sql|flipside|metrics)\b/],
  ['research', /\b(research|report|analysis|deep[- ]dive|case study|comparison)\b/],
  ['writing', /\b(article|blog|write|writing|essay|guide|tutorial|documentation|docs|newsletter|explainer|thread)\b/],
  ['community', /\b(community|discord|moderat\w*|ambassador)\b/],
  ['growth', /\b(marketing|growth|campaign|referral|onboard\w* users|kol|business development)\b/],
  ['content', /\b(content|social media|post|carousel|copywriting)\b/],
];

const SUBSKILL_CATEGORY: Record<string, Category> = {
  Writing: 'writing',
  Research: 'research',
  Video: 'video',
  'Video Editing': 'video',
  Photography: 'video',
  'Social Media': 'content',
  'Data Analytics': 'data',
  'Product Feedback': 'other',
};

const PARENT_CATEGORY: Record<string, Category> = {
  Frontend: 'code',
  Backend: 'code',
  Blockchain: 'code',
  Mobile: 'code',
  Design: 'design',
  Community: 'community',
  Growth: 'growth',
  Content: 'content',
  Other: 'other',
};

export function listingText(d: Partial<ListingDetails>): string {
  return `${d.title ?? ''}\n${htmlToText(d.description)}\n${htmlToText(d.requirements)}`.toLowerCase();
}

export function classify(d: Partial<ListingDetails>): Category {
  const title = (d.title ?? '').toLowerCase();
  const body = listingText(d);
  const votes = new Map<Category, number>();
  const vote = (c: Category, w: number) => votes.set(c, (votes.get(c) ?? 0) + w);

  for (const group of d.skills ?? []) {
    const subs = group.subskills ?? [];
    const mapped = subs.map((s) => SUBSKILL_CATEGORY[s]).filter(Boolean) as Category[];
    if (mapped.length) mapped.forEach((c) => vote(c, 2));
    else if (PARENT_CATEGORY[group.skills]) vote(PARENT_CATEGORY[group.skills], 2);
  }
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(title)) vote(cat, 3);
    const hits = body.match(new RegExp(re.source, 'g'))?.length ?? 0;
    if (hits) vote(cat, Math.min(hits, 4) * 0.5);
  }
  // A translation request trumps everything else it mentions.
  if (/\b(translat\w*|traduction)\b/.test(title)) return 'translation';

  let best: Category = 'other';
  let bestVotes = 0;
  for (const [c, v] of votes) {
    if (v > bestVotes) {
      best = c;
      bestVotes = v;
    }
  }
  return best;
}

interface BlockerRule {
  id: string;
  hard: boolean;
  test: (text: string, title: string, d: Partial<ListingDetails>, cat: Category) => boolean;
}

const MUST = String.raw`\b(must|need to|needs to|required to|have to|should|requirement)\b`;

const BLOCKER_RULES: BlockerRule[] = [
  {
    id: 'hackathon_track: multi-week build judged with demo/deployment',
    hard: true,
    test: (_t, _ti, d) => d.type === 'hackathon',
  },
  {
    id: 'project_gig: freelance engagement that needs the human operator to deliver ongoing work',
    hard: true,
    test: (_t, _ti, d) => d.type === 'project',
  },
  {
    id: 'video_or_audio_production',
    hard: true,
    test: (_t, _ti, _d, cat) => cat === 'video',
  },
  {
    id: 'mentions_video (worker must confirm it is optional)',
    hard: false,
    test: (t, _ti, _d, cat) => cat !== 'video' && /\b(video|loom|screen[- ]?record\w*|youtube)\b/.test(t),
  },
  {
    id: 'x_post_required: the deliverable is a post/thread on X we cannot publish',
    hard: true,
    test: (_t, ti, _d, cat) => cat !== 'code' && /\b(tweets?|twitter|x thread|thread on x|threads?)\b/.test(ti),
  },
  {
    id: 'mentions_social_publication (worker must confirm a document link is accepted)',
    hard: false,
    test: (t) =>
      /\b(post|publish|share)\w*\b.{0,30}\b(on|to) (x|twitter|medium|linkedin|instagram|tiktok|youtube)\b/.test(t) ||
      /\b(quote[- ]tweet|retweet|twitter thread|x thread)\b/.test(t),
  },
  {
    id: 'physical_presence',
    hard: true,
    test: (t) => /\b(irl|in[- ]person|meet-?ups?|on[- ]site|venue|host(ing)? (an? )?(event|workshop|meetup))\b/.test(t),
  },
  {
    id: 'audience_required: needs an existing social following',
    hard: true,
    test: (t) => /\b(followers|follower count|engagement rate|impressions|views on your)\b/.test(t),
  },
  {
    id: 'onchain_spending: requires transactions, holdings or mainnet deployment',
    hard: true,
    test: (t) =>
      /\b(deploy\w* (on|to) mainnet|mainnet deploy\w*)\b/.test(t) ||
      new RegExp(`${MUST}.{0,50}\\b(swap|stake|deposit|mint|bridge|hold|purchase|buy|pay)\\b`).test(t),
  },
  {
    id: 'product_usage: needs hands-on use of a live app (no general web access in the worker)',
    hard: true,
    test: (t, _ti, d) =>
      (d.skills ?? []).some((g) => (g.subskills ?? []).includes('Product Feedback')) ||
      /\b(user feedback|feedback on (the|our)|bug report\w*|ux review|usability)\b/.test(t),
  },
  {
    id: 'design_assets: visual/graphic production',
    hard: true,
    test: (_t, _ti, _d, cat) => cat === 'design',
  },
  {
    id: 'community_role',
    hard: true,
    test: (_t, _ti, _d, cat) => cat === 'community',
  },
  {
    id: 'growth_campaign: needs outreach, referrals or user acquisition',
    hard: true,
    test: (t, _ti, _d, cat) =>
      cat === 'growth' && /\b(referral|onboard\w* (users|people)|bring (in )?users|kol|ambassador|campaign)\b/.test(t),
  },
  {
    id: 'personal_account_in_eligibility: a required question asks for an account we do not own',
    hard: true,
    test: (_t, _ti, d) =>
      (d.eligibility ?? []).some(
        (q) =>
          !q.optional &&
          /\b(twitter|x handle|x profile|x account|instagram|tiktok|youtube channel|discord|telegram|wallet|solana address|phone|e-?mail|linkedin|github (profile|username))\b/i.test(
            q.question,
          ),
      ),
  },
];

/**
 * `relaxed` lists rule-id prefixes downgraded from hard to soft (settings),
 * so the worker reads the listing and decides instead of the hub skipping it.
 */
export function detectBlockers(d: Partial<ListingDetails>, cat: Category, allowedRegions: string[], relaxed: string[] = []) {
  const text = listingText(d);
  const title = (d.title ?? '').toLowerCase();
  const hard: string[] = [];
  const soft: string[] = [];
  for (const rule of BLOCKER_RULES) {
    if (!rule.test(text, title, d, cat)) continue;
    const isHard = rule.hard && !relaxed.some((p) => rule.id.startsWith(p));
    (isHard ? hard : soft).push(rule.id);
  }
  const region = (d.region ?? 'Global').trim();
  if (region && !/^global$/i.test(region) && !allowedRegions.some((r) => region.toLowerCase().includes(r.toLowerCase()))) {
    hard.push(`regional_listing: restricted to ${region}`);
  }
  if (d.sponsor?.isCaution) soft.push('sponsor_flagged_caution');
  return { hard, soft };
}

export function estimateHours(d: Partial<ListingDetails>, cat: Category): number {
  const text = listingText(d);
  let h = BASE_HOURS[cat];
  if (text.length > 4000) h += 1;
  if (/\b(comprehensive|in-depth|detailed|deep[- ]dive|[2-9],?000\+? words)\b/.test(text)) h += 1;
  if (cat === 'code') {
    if (/\b(full[- ]stack|frontend and backend|dapp|smart contract|on-?chain program|anchor)\b/.test(text)) h += 3;
    if (/\b(tests?|test coverage|ci)\b/.test(text)) h += 1;
  }
  return h;
}

/** Positions 1..n plus bonus spots (key "99" is the per-spot bonus amount). */
export function prizeStructure(d: Partial<ListingDetails>, fallbackAmount: number | null | undefined) {
  const rewards = d.rewards ?? {};
  const positions = Object.entries(rewards)
    .filter(([k, v]) => k !== '99' && Number.isFinite(Number(k)) && typeof v === 'number' && v > 0)
    .map(([, v]) => v as number);
  const bonusSpots = d.maxBonusSpots ?? 0;
  const bonusEach = typeof rewards['99'] === 'number' ? (rewards['99'] as number) : 0;
  let pool = positions.reduce((a, b) => a + b, 0) + bonusSpots * bonusEach;
  let winners = positions.length + (bonusEach > 0 ? bonusSpots : 0);
  if (!pool && fallbackAmount) {
    pool = fallbackAmount;
    winners = 1;
  }
  return { pool, winners: Math.max(winners, 1), firstPrize: positions.length ? Math.max(...positions) : pool };
}

export interface AssessInput {
  live: Partial<LiveListing>;
  details: Partial<ListingDetails>;
  tokenUsd: number | null;
  now: Date;
  settings: Pick<Settings, 'minScore' | 'minHoursLeft'>;
  allowedRegions?: string[];
  relaxedBlockers?: string[];
}

export function assess(input: AssessInput): Assessment {
  const { live, details, tokenUsd, now, settings } = input;
  const d: Partial<ListingDetails> = { ...live, ...details } as Partial<ListingDetails>;
  const category = classify(d);
  const preferred = PREFERRED.has(category);
  const { hard, soft } = detectBlockers(d, category, input.allowedRegions ?? [], input.relaxedBlockers ?? []);
  const estHours = estimateHours(d, category);

  const deadline = d.deadline ? new Date(d.deadline) : null;
  const hoursLeft = deadline ? (deadline.getTime() - now.getTime()) / 3_600_000 : 0;
  if (!deadline || hoursLeft < settings.minHoursLeft) hard.push(`deadline_too_close: ${hoursLeft.toFixed(1)}h left`);

  const { pool, winners } = prizeStructure(d, d.rewardAmount);
  const prizePoolUsd = tokenUsd != null && pool ? pool * tokenUsd : null;
  const avgPrizeUsd = prizePoolUsd != null ? prizePoolUsd / winners : null;

  const current = live._count?.Submission ?? 0;
  const published = d.publishedAt ? new Date(d.publishedAt).getTime() : null;
  let elapsed = 0.5;
  if (published && deadline && deadline.getTime() > published) {
    elapsed = (now.getTime() - published) / (deadline.getTime() - published);
  }
  elapsed = Math.min(Math.max(elapsed, 0.15), 1);
  const projectedSubmissions = Math.max(current + 2, current / elapsed);

  let p = (winners / (projectedSubmissions + 1)) * AI_COMPETITIVENESS[category];
  if (d.agentAccess === 'AGENT_ONLY') p *= 1.3;
  p *= Math.pow(0.7, soft.length);
  const winProbability = Math.min(Math.max(p, 0), 0.7);

  let paymentConfidence = 0.9;
  if (d.isFndnPaying) paymentConfidence = 0.97;
  if (d.sponsor?.isVerified === false) paymentConfidence = 0.6;
  if (d.sponsor?.isCaution) paymentConfidence = 0.4;

  const expectedUsd = avgPrizeUsd != null ? winProbability * avgPrizeUsd * paymentConfidence : 0;
  const score = (expectedUsd / estHours) * (preferred ? 1.25 : 1);

  let decision: Assessment['decision'] = 'candidate';
  let reason = `expected $${expectedUsd.toFixed(2)} over ~${estHours}h (p=${(winProbability * 100).toFixed(1)}%, ${winners} winner slot(s), ~${Math.round(projectedSubmissions)} entries)`;
  if (hard.length) {
    decision = 'skip';
    reason = `blocked: ${hard.join('; ')}`;
  } else if (prizePoolUsd == null) {
    decision = 'skip';
    reason = `no USD price for token ${d.token ?? '?'}`;
  } else if (score < settings.minScore) {
    decision = 'skip';
    reason = `score ${score.toFixed(2)} below minimum ${settings.minScore} — ${reason}`;
  }

  return {
    category,
    preferred,
    hardBlockers: hard,
    softBlockers: soft,
    estHours,
    winners,
    projectedSubmissions,
    winProbability,
    paymentConfidence,
    prizePoolUsd,
    avgPrizeUsd,
    expectedUsd,
    hoursLeft,
    score,
    decision,
    reason,
  };
}

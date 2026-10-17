import type { ListingDetails, Manifest, Settings, SubmissionPayload } from './types.ts';
import { markdownToSubmissionHtml } from './text.ts';

// Same pattern Earn validates `link` against (src/constants/URL_REGEX.ts).
export const EARN_URL_REGEX =
  /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%_+~#=]+(?:\.[-a-zA-Z0-9@:%_+~#=]+)*\.[a-zA-Z0-9()]{1,256}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/i;

const PLACEHOLDER =
  /\b(TODO|TBD|FIXME|lorem ipsum)\b|\[(insert|your|link|placeholder|add)[^\]]*\]|\{\{[^}]*\}\}|<insert|\bXXX\b/i;
const SECRET = /\bsk_[A-Za-z0-9_-]{10,}|\bgh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJhbGciOi[A-Za-z0-9_-]{20,}/;
const SAFE_PATH = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]{1,200}$/;
const URL_IN_TEXT = /https?:\/\/[^\s)<>"']+/g;

export interface QaContext {
  details: ListingDetails;
  jobSlug: string;
  settings: Settings;
  sha: string;
  primaryText: string | null;
  now: Date;
}

export interface QaResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  payload: SubmissionPayload | null;
  link: string | null;
}

export function deliverableUrl(s: Pick<Settings, 'repoOwner' | 'repoName'>, sha: string, slug: string, file?: string) {
  const base = `https://github.com/${s.repoOwner}/${s.repoName}`;
  const dir = `deliverables/${encodeURIComponent(slug)}`;
  return file ? `${base}/blob/${sha}/${dir}/${file.split('/').map(encodeURIComponent).join('/')}` : `${base}/tree/${sha}/${dir}`;
}

function ownRepoUrl(url: string, s: Settings): boolean {
  return url.startsWith(`https://github.com/${s.repoOwner}/${s.repoName}/`);
}

/**
 * Deterministic gate run by the hub before anything is sent to Earn. The AI
 * worker has its own review; this one enforces the rules that must never be
 * left to judgement: listing still open, every required answer present, no
 * link we do not control, no placeholder or secret, and a passing review.
 */
export function validateManifest(m: Manifest, ctx: QaContext): QaResult {
  const { details: d, settings: s } = ctx;
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (e: string) => errors.push(e);

  if (m.version !== 1) fail('manifest.version must be 1');
  if (m.listingId !== d.id) fail(`manifest.listingId ${m.listingId} does not match listing ${d.id}`);
  if (m.slug !== ctx.jobSlug) fail(`manifest.slug ${m.slug} does not match job ${ctx.jobSlug}`);
  if (m.status !== 'ready') fail(`manifest.status is ${m.status}, expected ready`);

  // Listing must still accept agent submissions.
  if (d.status && d.status !== 'OPEN') fail(`listing status is ${d.status}`);
  if (d.isWinnersAnnounced) fail('winners already announced');
  if (d.agentAccess !== 'AGENT_ALLOWED' && d.agentAccess !== 'AGENT_ONLY') fail('listing does not accept agents');
  const deadline = d.deadline ? new Date(d.deadline).getTime() : 0;
  if (deadline < ctx.now.getTime() + 5 * 60_000) fail('deadline passed or less than 5 minutes away');

  // The deliverable itself.
  const primary = m.primaryFile ?? 'README.md';
  if (!SAFE_PATH.test(primary)) fail(`primaryFile "${primary}" is not a safe relative path`);
  if (ctx.primaryText == null) fail(`primary file deliverables/${m.slug}/${primary} not found at ${ctx.sha}`);
  else {
    if (ctx.primaryText.trim().length < 600) fail('primary deliverable is shorter than 600 characters');
    if (PLACEHOLDER.test(ctx.primaryText)) fail('primary deliverable contains a placeholder (TODO/TBD/[insert…]/{{…}})');
    if (SECRET.test(ctx.primaryText)) fail('primary deliverable looks like it contains a secret');
  }

  // Description for the sponsor.
  const otherInfo = (m.otherInfo ?? '').trim();
  if (otherInfo.length < 80) fail('otherInfo must explain the submission (min 80 characters)');
  if (otherInfo.length > 4000) fail('otherInfo is longer than 4000 characters');
  if (PLACEHOLDER.test(otherInfo)) fail('otherInfo contains a placeholder');
  if (SECRET.test(otherInfo)) fail('otherInfo looks like it contains a secret');
  if (!/\b(AI|artificial intelligence|agent)\b/i.test(otherInfo)) fail('otherInfo must disclose that an AI agent produced the work');
  const listingUrls = new Set(`${d.description ?? ''} ${d.requirements ?? ''}`.match(URL_IN_TEXT) ?? []);
  for (const u of otherInfo.match(URL_IN_TEXT) ?? []) {
    if (!ownRepoUrl(u, s) && !listingUrls.has(u)) warnings.push(`otherInfo cites external URL ${u}`);
  }

  // Eligibility answers: one per question, required ones non-empty, links ours.
  const answers: { question: string; answer: string }[] = [];
  const given = m.eligibilityAnswers ?? [];
  (d.eligibility ?? []).forEach((q, i) => {
    const hit = given.find((a) => a.question?.trim() === q.question.trim()) ?? given[i];
    const answer = (hit?.answer ?? '').trim();
    if (!answer && !q.optional) fail(`missing answer to required question "${q.question}"`);
    if (answer) {
      if (PLACEHOLDER.test(answer)) fail(`answer to "${q.question}" contains a placeholder`);
      if (SECRET.test(answer)) fail(`answer to "${q.question}" looks like it contains a secret`);
      if (q.isLink || q.type === 'link') {
        if (!EARN_URL_REGEX.test(answer)) fail(`answer to link question "${q.question}" is not a URL`);
        else if (!ownRepoUrl(answer, s) && !listingUrls.has(answer)) {
          fail(`answer to "${q.question}" links outside our deliverables (${answer}); we only submit proof we produced`);
        }
      }
      for (const u of answer.match(URL_IN_TEXT) ?? []) {
        if (!ownRepoUrl(u, s) && !listingUrls.has(u)) fail(`answer to "${q.question}" cites ${u}, which we do not control`);
      }
    }
    answers.push({ question: q.question, answer });
  });
  if (given.length > (d.eligibility ?? []).length) warnings.push('extra eligibility answers were ignored');

  // Quote for range/variable compensation.
  let ask: number | null = null;
  const needsAsk = d.type === 'project' && d.compensationType && d.compensationType !== 'fixed';
  if (needsAsk) {
    if (typeof m.ask !== 'number' || !(m.ask > 0)) fail('this listing requires an ask (quote)');
    else if (d.compensationType === 'range' && (m.ask < (d.minRewardAsk ?? 0) || m.ask > (d.maxRewardAsk ?? Infinity))) {
      fail(`ask ${m.ask} outside ${d.minRewardAsk}–${d.maxRewardAsk}`);
    } else ask = Math.round(m.ask * 10_000) / 10_000;
  }
  if (d.type === 'project' && !s.telegramUrl) fail('project listings require the operator Telegram URL (settings.telegramUrl)');

  // Independent review recorded by the worker.
  const qa = m.qa ?? {};
  if (typeof qa.score !== 'number' || qa.score < s.minQaScore) fail(`qa.score ${qa.score} below ${s.minQaScore}`);
  if (!qa.reviewer || /^self$/i.test(qa.reviewer)) fail('qa.reviewer must name the independent reviewer pass');
  if (!qa.checklist?.length) fail('qa.checklist is empty');
  else if (qa.checklist.some((c) => !c.met)) fail(`qa.checklist has unmet requirements: ${qa.checklist.filter((c) => !c.met).map((c) => c.requirement).join('; ')}`);
  if (qa.originality !== true) fail('qa.originality not confirmed');
  if (qa.noFabrication !== true) fail('qa.noFabrication not confirmed');
  if (qa.languageOk !== true) fail('qa.languageOk not confirmed');

  const link = deliverableUrl(s, ctx.sha, m.slug, m.linkTarget === 'folder' ? undefined : primary);
  if (!EARN_URL_REGEX.test(link)) fail(`generated link does not pass Earn URL validation: ${link}`);

  const payload: SubmissionPayload | null = errors.length
    ? null
    : {
        listingId: d.id,
        link,
        tweet: '',
        otherInfo: markdownToSubmissionHtml(otherInfo),
        eligibilityAnswers: answers,
        ask,
        ...(d.type === 'project' && s.telegramUrl ? { telegram: s.telegramUrl } : {}),
      };
  return { ok: errors.length === 0, errors, warnings, payload, link };
}

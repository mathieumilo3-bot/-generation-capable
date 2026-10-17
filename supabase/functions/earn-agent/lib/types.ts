// Shapes returned by the Superteam Earn agent API (see https://superteam.fun/skill.md
// and SuperteamDAO/earn: src/pages/api/agents/**). Only the fields we use are typed.

export type ListingType = 'bounty' | 'project' | 'hackathon';
export type AgentAccess = 'HUMAN_ONLY' | 'AGENT_ALLOWED' | 'AGENT_ONLY';
export type CompensationType = 'fixed' | 'range' | 'variable';

export interface EligibilityQuestion {
  order?: number;
  question: string;
  type?: 'text' | 'link';
  optional?: boolean;
  isLink?: boolean;
}

export interface SkillGroup {
  skills: string;
  subskills?: string[];
}

export interface Sponsor {
  name?: string;
  slug?: string;
  url?: string;
  isVerified?: boolean;
  isCaution?: boolean;
}

/** Item of GET /api/agents/listings/live */
export interface LiveListing {
  id: string;
  slug: string;
  title: string;
  type: ListingType;
  token?: string | null;
  rewardAmount?: number | null;
  deadline?: string | null;
  compensationType?: CompensationType;
  minRewardAsk?: number | null;
  maxRewardAsk?: number | null;
  agentAccess?: AgentAccess;
  status?: string;
  isWinnersAnnounced?: boolean;
  isFeatured?: boolean;
  isPro?: boolean;
  _count?: { Comments?: number; Submission?: number };
  sponsor?: Sponsor;
}

/** GET /api/agents/listings/details/:slug */
export interface ListingDetails {
  id: string;
  slug: string;
  title: string;
  type: ListingType;
  description?: string | null;
  requirements?: string | null;
  deadline?: string | null;
  publishedAt?: string | null;
  eligibility?: EligibilityQuestion[] | null;
  status?: string;
  token?: string | null;
  rewardAmount?: number | null;
  rewards?: Record<string, number> | null;
  maxBonusSpots?: number | null;
  skills?: SkillGroup[] | null;
  region?: string | null;
  agentAccess?: AgentAccess;
  compensationType?: CompensationType;
  minRewardAsk?: number | null;
  maxRewardAsk?: number | null;
  isFndnPaying?: boolean;
  isWinnersAnnounced?: boolean;
  winnersAnnouncedAt?: string | null;
  isPro?: boolean;
  pocSocials?: string | null;
  sponsor?: Sponsor;
  poc?: { id?: string; firstName?: string; lastName?: string; username?: string };
  Hackathon?: { name?: string; deadline?: string } | null;
}

export interface Winner {
  id: string;
  winnerPosition?: number | null;
  user?: { id?: string; username?: string };
}

export interface AgentIdentity {
  agentId: string;
  userId: string;
  name: string;
  username: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: string;
  userId: string;
  claimedByUserId?: string | null;
  claimedAt?: string | null;
}

export interface SubmissionPayload {
  listingId: string;
  link: string;
  tweet: string;
  otherInfo: string;
  eligibilityAnswers: { question: string; answer: string }[];
  ask: number | null;
  telegram?: string;
}

/** deliverables/<slug>/submission.json written by the AI worker. */
export interface Manifest {
  version: number;
  listingId: string;
  slug: string;
  status: 'ready' | 'abandoned';
  abandonReason?: string;
  primaryFile?: string;
  linkTarget?: 'file' | 'folder';
  otherInfo?: string;
  eligibilityAnswers?: { question: string; answer: string }[];
  ask?: number | null;
  qa?: {
    score?: number;
    reviewer?: string;
    checklist?: { requirement: string; met: boolean; evidence?: string }[];
    originality?: boolean;
    noFabrication?: boolean;
    languageOk?: boolean;
    notes?: string;
  };
  createdAt?: string;
}

export type Category =
  | 'writing'
  | 'translation'
  | 'code'
  | 'data'
  | 'research'
  | 'content'
  | 'design'
  | 'video'
  | 'community'
  | 'growth'
  | 'other';

export interface Assessment {
  category: Category;
  preferred: boolean;
  hardBlockers: string[];
  softBlockers: string[];
  estHours: number;
  winners: number;
  projectedSubmissions: number;
  winProbability: number;
  paymentConfidence: number;
  prizePoolUsd: number | null;
  avgPrizeUsd: number | null;
  expectedUsd: number;
  hoursLeft: number;
  score: number;
  decision: 'candidate' | 'skip';
  reason: string;
}

export interface Settings {
  autoSubmit: boolean;
  maxActiveJobs: number;
  dailySubmissionCap: number;
  minScore: number;
  minHoursLeft: number;
  minQaScore: number;
  telegramUrl: string | null;
  /** Non-global listings are only taken in these regions (payout goes to the human claimant). */
  allowedRegions: string[];
  repoOwner: string;
  repoName: string;
  branch: string;
}

export const DEFAULT_SETTINGS: Settings = {
  autoSubmit: true,
  maxActiveJobs: 5,
  dailySubmissionCap: 8,
  minScore: 1,
  minHoursLeft: 4,
  minQaScore: 8,
  telegramUrl: null,
  allowedRegions: ['France'],
  repoOwner: 'mathieumilo3-bot',
  repoName: '-generation-capable',
  branch: 'earn-agent',
};

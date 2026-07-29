export { EXECUTIVE_BRAINS, runBrains, type BrainDefinition, type ProposalRule } from "./brains";
export {
  arbitrate,
  scoreProposal,
  DECISION_WEIGHTS,
  TIE_THRESHOLD,
  type Arbitration,
  type ScoredProposal,
} from "./decision-engine";
export {
  computeEnterpriseScore,
  DOMAIN_LABELS,
  type DomainScore,
  type EnterpriseScore,
} from "./enterprise-score";
export { buildDailyBriefing, type DailyBriefing } from "./briefing";
export type { BrainProposal, BrainReport, Effort, Horizon, Risk } from "./types";

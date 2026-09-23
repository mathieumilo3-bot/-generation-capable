/**
 * Core types for the Capable Audit business-intelligence engine.
 *
 * The one rule every type here exists to enforce: nothing produced by this
 * engine may present a guess as a fact. Every `Signal` carries a
 * `Confidence`, and every `Finding` shown to a visitor names the evidence
 * that led to it. See ARCHITECTURE.md for the full pipeline.
 */

/**
 * OBSERVED — read directly off the site or declared by the visitor.
 * INFERRED — a reasonable deduction from what was observed, never a measurement.
 * UNKNOWN — genuinely inaccessible (site unreachable, data private, not on the page).
 *
 * The engine never fabricates a number to avoid returning UNKNOWN — a business
 * metric (revenue, conversion rate, traffic, ad performance) that isn't
 * directly observable stays UNKNOWN, permanently. See `assertNoFabrication`
 * in report.ts for the test-time guard against regressions on this rule.
 */
export type Confidence = "observed" | "inferred" | "unknown";

/** A single piece of evidence with its reliability attached. */
export type Signal<T> = {
  value: T;
  confidence: Confidence;
  /** Where this came from, e.g. "balise <title>", "formulaire — secteur déclaré". */
  source: string;
};

export function observed<T>(value: T, source: string): Signal<T> {
  return { value, confidence: "observed", source };
}
export function inferred<T>(value: T, source: string): Signal<T> {
  return { value, confidence: "inferred", source };
}
export function unknown<T>(source: string): Signal<T | null> {
  return { value: null, confidence: "unknown", source };
}

/** The eleven analysis dimensions the pipeline runs, in the brief's order. */
export type Dimension =
  | "positioning"
  | "psychology"
  | "offer"
  | "acquisition"
  | "funnel"
  | "conversion"
  | "trust"
  | "social_proof"
  | "price_value"
  | "retention"
  | "business_model";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  positioning: "Positionnement",
  psychology: "Parcours psychologique",
  offer: "Offre & gamme",
  acquisition: "Acquisition",
  funnel: "Parcours client",
  conversion: "Conversion",
  trust: "Confiance",
  social_proof: "Preuve sociale",
  price_value: "Prix / valeur",
  retention: "Rétention",
  business_model: "Modèle économique",
};

/**
 * One analyzed observation. `impact` and `effort` are 1–5 heuristic scales
 * set explicitly by the analyzer that produced the finding (never invented
 * after the fact) — see each analyzer's own comments for its scoring logic.
 */
export type Finding = {
  id: string;
  dimension: Dimension;
  /** Short, client-facing name for this finding, e.g. "Offre peu différenciée". */
  title: string;
  /** One or two sentences: what was found and why it matters. */
  statement: string;
  /** Concrete evidence backing the statement — quoted or described, never invented. */
  evidence: string[];
  confidence: Confidence;
  /** 1 (marginal) – 5 (structural) potential impact on the objective declared. */
  impact: number;
  /** 1 (needs a rebuild) – 5 (fixable in an afternoon) ease of correction. */
  effort: number;
  /** Whether this finding is positive ("works") rather than a leak ("blocks"). */
  polarity: "positive" | "negative";
  /** What we would concretely do about it — only present for negative findings. */
  recommendation?: string;
};

/** Raw signals collected about the site, before any interpretation. */
export type SiteSignals = {
  reachable: boolean;
  /** Why the probe could not reach or read the site, if it couldn't. */
  unreachableReason?: "invalid_url" | "blocked_target" | "network_error" | "timeout" | "http_error" | "empty_body";
  finalUrl?: string;
  httpStatus?: number;
  responseTimeMs?: number;
  isHttps?: boolean;
  title: Signal<string | null>;
  metaDescription: Signal<string | null>;
  h1: Signal<string[] | null>;
  wordCount: Signal<number | null>;
  hasViewportMeta: Signal<boolean | null>;
  hasHtmlLangAttr: Signal<boolean | null>;
  hasStructuredData: Signal<boolean | null>;
  telLinkCount: Signal<number | null>;
  mailtoLinkCount: Signal<number | null>;
  formCount: Signal<number | null>;
  socialLinks: Signal<Partial<Record<SocialNetwork, string>> | null>;
  actionWords: Signal<string[] | null>;
  priceMentionCount: Signal<number | null>;
  testimonialSignalCount: Signal<number | null>;
  faqSignalPresent: Signal<boolean | null>;
  guaranteeSignalPresent: Signal<boolean | null>;
  urgencySignalPresent: Signal<boolean | null>;
  legalNoticeLinkPresent: Signal<boolean | null>;
  /** Public page text excerpt, bounded and treated as untrusted data by the AI synthesis layer. */
  textExcerpt?: Signal<string | null>;
};

export type SocialNetwork =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "twitter";

/** What the visitor told us — always OBSERVED (self-reported, not measured). */
export type DeclaredInput = {
  /** Nom public de l'entreprise quand il est fourni par le visiteur. */
  entreprise?: string;
  /** Site officiel résolu automatiquement quand il est trouvé. Peut rester vide. */
  siteUrl: string;
  secteur: string;
  objectif: string;
};

export type EngineInput = DeclaredInput;

export type AiAuditPillar = "attirer" | "rassurer" | "convertir";

export type AiAuditOpportunity = {
  id: string;
  pillar: AiAuditPillar;
  title: string;
  diagnosis: string;
  evidence: string[];
  confidence: "observed" | "inferred";
  impact: string;
  /** Heuristic audit score, 1–10, derived from observed/public evidence — never a traffic or conversion metric. */
  score?: number;
  /** One concrete low-risk action the prospect can understand and start immediately. */
  firstAction?: string;
  callQuestion: string;
};

export type AiAuditWebSource = {
  title: string;
  url: string;
};

export type AiAuditSynthesis = {
  detectedSector: string;
  officialSite: string;
  executiveSummary: string;
  companySnapshot: string;
  attirer: string;
  rassurer: string;
  convertir: string;
  opportunities: AiAuditOpportunity[];
  worksWell: string;
  callBridge: string;
  model: string;
  /** Search queries actually issued by the hosted web-search tool, when used. */
  webQueries?: string[];
  /** Sources actually returned by the hosted web-search tool, when used. */
  webSources?: AiAuditWebSource[];
};

export type SectorId =
  | "dentiste_sante"
  | "coach"
  | "consultant"
  | "agence"
  | "restaurant"
  | "immobilier"
  | "artisan"
  | "ecommerce"
  | "salle_de_sport"
  | "beaute_esthetique"
  | "formation"
  | "services_locaux"
  | "saas_logiciel"
  | "avocat_reglemente"
  | "automobile"
  | "autre";

export type SectorProfile = {
  id: SectorId;
  label: string;
  /** Keywords matched (case/diacritics-insensitive) against the declared secteur string. */
  matches: string[];
  priorityDimensions: Dimension[];
  trustSignals: string[];
  channels: string[];
  commonObjections: string[];
  conversionLevers: string[];
  typicalOpportunities: string[];
  /** Shown alongside any finding using this profile — these are heuristics, not universal truths. */
  limits: string;
};

export type ReportHeader = {
  entreprise: string;
  secteur: string;
  sectorProfile: SectorId;
  objectif: string;
  siteUrl: string;
  generatedAt: string;
  siteReachable: boolean;
};

export type Report = {
  header: ReportHeader;
  /** 3–5 prioritized leaks, highest priority first. */
  topLeaks: Finding[];
  /** Up to 3 things observed to be working. */
  worksWell: Finding[];
  /** Every negative finding not promoted to topLeaks — kept internally, not narrated 1:1 in the UI. */
  otherFindings: Finding[];
  actionPlan: { order: number; title: string; recommendation: string }[];
  /** True when the site could not be probed — the report still ships, sector-heuristics-only. */
  degraded: boolean;
  degradedReason?: string;
  /** The sector profile's own stated caveat — always shown, never folded into a Finding. */
  sectorNote: string;
  engineVersion: string;
  /** Optional OpenAI synthesis. Missing when no key is configured or the AI layer fails soft. */
  aiSynthesis?: AiAuditSynthesis;
};

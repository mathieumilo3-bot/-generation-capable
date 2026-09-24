import type { CompanyDiscoveryCandidate } from "@/lib/audit-engine/company-discovery";
import type { RegistryCandidate } from "@/lib/audit-engine/company-registry";
import type { DiagnosticResult, Dossier, ResearchNotes } from "@/lib/audit-engine/diagnostic";
import type { RawImage, SiteParagraph, SiteReviewMention } from "./assets";
import type { BlueprintRejection } from "./blueprint-validate";

export const STAGES = [
  "identity",
  "discovery",
  "crawl",
  "research",
  "truth_bundle",
  "blueprint",
  "validate",
  "render",
  "store",
  "notify",
] as const;

export type StageName = (typeof STAGES)[number];

export type StageState = {
  status: "pending" | "running" | "done" | "skipped" | "failed";
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  retryCount: number;
  engineVersion: string;
};

export type PipelineState = Record<StageName, StageState>;

export type JobRef = { id: string; startedAt: string; rescue?: boolean };

/** Intermediate data. Server-side only: never sent to the browser. */
export type PreviewWork = {
  registry?: RegistryCandidate | null;
  userCity?: string;
  userSite?: string;
  noSite?: boolean;
  discoveryJob?: JobRef;
  rescueTried?: boolean;
  candidates?: CompanyDiscoveryCandidate[];
  discovery?: CompanyDiscoveryCandidate | null;
  dossier?: Dossier;
  assets?: {
    images: RawImage[];
    paragraphs?: SiteParagraph[];
    logo: RawImage | null;
    siteName?: string;
    emails: string[];
    reviewMentions: SiteReviewMention[];
  } | null;
  observedColors?: string[];
  investigationJob?: JobRef;
  diagnostic?: DiagnosticResult;
  research?: ResearchNotes | null;
  blueprintJob?: JobRef;
  blueprintRaw?: unknown;
  blueprintModel?: string;
  blueprintSource?: "ai" | "mixed" | "base";
  rejections?: BlueprintRejection[];
  followId?: string;
  reusedFrom?: string;
  render?: { bytes: number; sections: number };
  /** Milliseconds spent per stage, for the latency budget. */
  timings?: Partial<Record<StageName, number>>;
};

import type { DeclaredInput, Finding, SectorProfile, SiteSignals } from "../types";
import { analyzePositioning } from "./positioning";
import { analyzePsychology } from "./psychology";
import { analyzeOffer } from "./offer";
import { analyzeAcquisition } from "./acquisition";
import { analyzeFunnel, analyzeConversion } from "./funnelConversion";
import { analyzeTrust, analyzeSocialProof } from "./trust";
import { analyzeBusinessModel } from "./businessModel";

export {
  analyzePositioning,
  analyzePsychology,
  analyzeOffer,
  analyzeAcquisition,
  analyzeFunnel,
  analyzeConversion,
  analyzeTrust,
  analyzeSocialProof,
  analyzeBusinessModel,
};

type Analyzer = (input: DeclaredInput, site: SiteSignals, sector: SectorProfile) => Finding[];

/** Every analyzer in the pipeline, in the brief's declared order. */
const ANALYZERS: Analyzer[] = [
  analyzePositioning,
  analyzePsychology,
  analyzeOffer,
  analyzeAcquisition,
  analyzeFunnel,
  analyzeConversion,
  analyzeTrust,
  analyzeSocialProof,
  analyzeBusinessModel,
];

/** Runs every analyzer and flattens the result. A single analyzer throwing never aborts the others. */
export function runAllAnalyzers(input: DeclaredInput, site: SiteSignals, sector: SectorProfile): Finding[] {
  const findings: Finding[] = [];
  for (const analyze of ANALYZERS) {
    try {
      findings.push(...analyze(input, site, sector));
    } catch (error) {
      console.error(`[audit-engine] analyzer failed (skipped):`, error);
    }
  }
  return findings;
}

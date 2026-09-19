import { classifySector } from "./classify";
import { probeSite } from "./probe";
import { runAllAnalyzers } from "./analyzers";
import { buildReport } from "./report";
import type { DeclaredInput, Report } from "./types";

const INPUT_LIMITS = { siteUrl: 300, secteur: 120, objectif: 120 };

export type RunAuditOptions = {
  /** Injectable for tests — defaults to the real network probe. */
  probe?: (url: string) => ReturnType<typeof probeSite>;
};

function clampInput(input: DeclaredInput): DeclaredInput {
  return {
    siteUrl: input.siteUrl.trim().slice(0, INPUT_LIMITS.siteUrl),
    secteur: input.secteur.trim().slice(0, INPUT_LIMITS.secteur),
    objectif: input.objectif.trim().slice(0, INPUT_LIMITS.objectif),
  };
}

/**
 * Runs the full Capable Audit pipeline: collecte → classification →
 * analyse (9 dimensions) → priorisation → rapport.
 *
 * Never throws — a probe failure degrades the report (see report.ts), it
 * never surfaces as an error to the caller. The only way this rejects is a
 * truly unexpected bug in an analyzer, and even that is caught per-analyzer
 * inside `runAllAnalyzers` so one broken module can't take down the report.
 */
export async function runAudit(rawInput: DeclaredInput, options: RunAuditOptions = {}): Promise<Report> {
  const input = clampInput(rawInput);
  const probe = options.probe ?? probeSite;

  const [site, sector] = await Promise.all([
    probe(input.siteUrl),
    Promise.resolve(classifySector(input.secteur)),
  ]);

  const findings = runAllAnalyzers(input, site, sector);
  return buildReport(input, site, sector, findings);
}

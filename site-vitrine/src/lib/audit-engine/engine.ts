import { classifySector } from "./classify";
import { probeSite } from "./probe";
import { runAllAnalyzers } from "./analyzers";
import { buildReport } from "./report";
import { synthesizeAuditWithOpenAI } from "./ai-synthesis";
import { discoverCompany } from "./company-discovery";
import type { DeclaredInput, Report } from "./types";

const INPUT_LIMITS = { entreprise: 160, siteUrl: 300, secteur: 120, objectif: 240 };

export type RunAuditOptions = {
  /** Injectable for tests — defaults to the real network probe. */
  probe?: (url: string) => ReturnType<typeof probeSite>;
  /** Injectable for tests — defaults to the real company web discovery. */
  discover?: typeof discoverCompany;
};

function clampInput(input: DeclaredInput): DeclaredInput {
  return {
    entreprise: input.entreprise?.trim().slice(0, INPUT_LIMITS.entreprise) ?? "",
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
  const discover = options.discover ?? discoverCompany;

  // Resolve the company again on the server before the audit. The visitor's
  // sector is only a hint; a verified public company match must win over a
  // mistaken manual choice or an earlier frontend discovery timeout.
  let resolvedInput = input;
  if (input.entreprise) {
    try {
      const discovery = await discover(input.entreprise);
      const candidate =
        discovery.candidates.find((item) => item.confidence === "high") ??
        discovery.candidates.find((item) => item.confidence === "medium") ??
        discovery.candidates[0];

      if (candidate) {
        resolvedInput = {
          ...input,
          entreprise: candidate.name || input.entreprise,
          siteUrl: candidate.website || input.siteUrl,
          secteur: candidate.sector || input.secteur,
        };
      }
    } catch (error) {
      console.warn("[audit-engine] server company resolution unavailable:", error);
    }
  }

  const [site, sector] = await Promise.all([
    probe(resolvedInput.siteUrl),
    Promise.resolve(classifySector(resolvedInput.secteur)),
  ]);

  const findings = runAllAnalyzers(resolvedInput, site, sector);
  const report = buildReport(resolvedInput, site, sector, findings);

  const aiSynthesis = await synthesizeAuditWithOpenAI({ input: resolvedInput, site, sector, report });
  return aiSynthesis ? { ...report, aiSynthesis } : report;
}

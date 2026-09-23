import { classifySector } from "./classify";
import { discoverCompany } from "./company-discovery";
import { buildDossier, diagnoseDossier, type Dossier, type DiagnosticResult } from "./diagnostic";
import { crawlSite } from "./crawl";
import type { DeclaredInput, Report } from "./types";

export const DIAGNOSTIC_ENGINE_VERSION = "2.0.0";

const INPUT_LIMITS = { entreprise: 160, siteUrl: 300, secteur: 120, objectif: 240, ville: 120 };

function clampInput(input: DeclaredInput & { ville?: string }): DeclaredInput & { ville: string } {
  return {
    entreprise: input.entreprise?.trim().slice(0, INPUT_LIMITS.entreprise) ?? "",
    siteUrl: input.siteUrl.trim().slice(0, INPUT_LIMITS.siteUrl),
    secteur: input.secteur.trim().slice(0, INPUT_LIMITS.secteur),
    objectif: input.objectif.trim().slice(0, INPUT_LIMITS.objectif),
    ville: input.ville?.trim().slice(0, INPUT_LIMITS.ville) ?? "",
  };
}

/**
 * Wraps a diagnostic into the Report contract the funnel, the thank-you page
 * and older stored sessions already understand.
 */
export function reportFromDiagnostic(dossier: Dossier, diagnostic: DiagnosticResult, objectif = ""): Report {
  const sector = classifySector(dossier.company.trade);
  return {
    header: {
      entreprise: dossier.company.name || dossier.company.domain || "Entreprise analysée",
      secteur: dossier.company.trade || sector.label,
      sectorProfile: sector.id,
      objectif,
      siteUrl: dossier.company.siteUrl,
      generatedAt: new Date().toISOString(),
      siteReachable: dossier.site.reachable,
    },
    topLeaks: [],
    worksWell: [],
    otherFindings: [],
    actionPlan: diagnostic.cards.map((card, index) => ({ order: index + 1, title: card.title, recommendation: card.fix })),
    degraded: !dossier.site.reachable,
    degradedReason: dossier.site.reachable
      ? undefined
      : dossier.company.siteUrl
        ? "Le site officiel n’a pas pu être lu directement ; le diagnostic s’appuie sur les sources publiques retrouvées."
        : "Aucun site officiel n’a été identifié ; le diagnostic s’appuie sur les sources publiques retrouvées.",
    sectorNote: sector.limits,
    engineVersion: DIAGNOSTIC_ENGINE_VERSION,
    diagnostic,
  };
}

export type RunAuditOptions = {
  discover?: typeof discoverCompany;
  crawl?: typeof crawlSite;
  build?: typeof buildDossier;
  diagnose?: typeof diagnoseDossier;
};

/**
 * One-shot pipeline, used when the two-stage flow is not available (the
 * research stage failed or an older client calls /api/audit/analyze with a
 * plain company). Resolves the company if no site is given, crawls the site,
 * then writes the cards — with a shorter research budget so the whole call
 * stays inside one synchronous function run. Never throws for a site or AI
 * failure: the site-verified cards are the floor.
 */
export async function runAudit(rawInput: DeclaredInput & { ville?: string }, options: RunAuditOptions = {}): Promise<Report> {
  const input = clampInput(rawInput);
  const started = Date.now();
  const discover = options.discover ?? discoverCompany;
  const build = options.build ?? buildDossier;
  const diagnose = options.diagnose ?? diagnoseDossier;

  let resolved = { ...input };
  const hasUsableSiteUrl = /^https?:\/\/[^/\s]+\.[^/\s]+/i.test(input.siteUrl);
  if (input.entreprise && !hasUsableSiteUrl) {
    try {
      const discovery = await discover(input.entreprise, { firstTimeoutMs: 14_000, skipRescue: true, cityHint: input.ville });
      const candidate =
        discovery.candidates.find((item) => item.confidence === "high" && item.website) ??
        discovery.candidates.find((item) => item.website) ??
        discovery.candidates[0];
      if (candidate) {
        resolved = {
          ...resolved,
          entreprise: candidate.name || resolved.entreprise,
          siteUrl: candidate.website || resolved.siteUrl,
          secteur: candidate.sector || resolved.secteur,
          ville: candidate.city || resolved.ville,
        };
      }
    } catch (error) {
      console.warn("[audit-engine] server company resolution unavailable:", error);
    }
  }

  const elapsed = Date.now() - started;
  const dossier = await build(
    { entreprise: resolved.entreprise ?? "", siteUrl: resolved.siteUrl, secteur: resolved.secteur, ville: resolved.ville },
    { budgetMs: Math.max(12_000, 30_000 - elapsed), crawl: options.crawl }
  );
  const diagnostic = await diagnose(dossier, { timeoutMs: Math.max(5_000, 55_000 - (Date.now() - started)) });
  return reportFromDiagnostic(dossier, diagnostic, resolved.objectif);
}

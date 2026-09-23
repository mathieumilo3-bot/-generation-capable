import { classifySector } from "./classify";
import { discoverCompany } from "./company-discovery";
import {
  buildDossier,
  diagnoseDossier,
  siteOnlyDiagnostic,
  toAuditContext,
  type AuditContext,
  type Dossier,
  type DiagnosticResult,
} from "./diagnostic";
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
export function reportFromContext(context: AuditContext, diagnostic: DiagnosticResult, objectif = ""): Report {
  const company = context.company;
  const sector = classifySector(company.trade);
  const reachable = context.stats.siteReachable;
  return {
    header: {
      entreprise: company.name || company.domain || "Entreprise analysée",
      secteur: company.trade || sector.label,
      sectorProfile: sector.id,
      objectif,
      siteUrl: company.siteUrl,
      generatedAt: new Date().toISOString(),
      siteReachable: reachable,
    },
    topLeaks: [],
    worksWell: [],
    otherFindings: [],
    actionPlan: diagnostic.cards.map((card, index) => ({ order: index + 1, title: card.title, recommendation: card.fix })),
    degraded: !reachable,
    degradedReason: reachable
      ? undefined
      : company.siteUrl
        ? "Le site officiel n’a pas pu être lu directement ; le diagnostic s’appuie sur les sources publiques retrouvées."
        : "Aucun site officiel n’a été identifié ; le diagnostic s’appuie sur les sources publiques retrouvées.",
    sectorNote: sector.limits,
    engineVersion: DIAGNOSTIC_ENGINE_VERSION,
    diagnostic,
  };
}

export function reportFromDossier(dossier: Dossier, diagnostic: DiagnosticResult, objectif = ""): Report {
  return reportFromContext(toAuditContext(dossier), diagnostic, objectif);
}

export type RunAuditOptions = {
  discover?: typeof discoverCompany;
  crawl?: typeof crawlSite;
  build?: typeof buildDossier;
  diagnose?: typeof diagnoseDossier;
  /**
   * Run the full investigation in this same call. Only for places where a
   * long request is allowed (scripts, tests) — the funnel uses the
   * background job instead, because the host cuts requests at 10 s.
   */
  withInvestigation?: boolean;
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
      const discovery = await discover(input.entreprise, { firstTimeoutMs: options.withInvestigation ? 20_000 : 3_500, skipRescue: true, cityHint: input.ville });
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

  const dossier = await build(
    { entreprise: resolved.entreprise ?? "", siteUrl: resolved.siteUrl, secteur: resolved.secteur, ville: resolved.ville },
    { budgetMs: 5_000, crawl: options.crawl }
  );
  const diagnostic = options.withInvestigation
    ? await diagnose(dossier, { timeoutMs: Math.max(5_000, 90_000 - (Date.now() - started)) })
    : siteOnlyDiagnostic(toAuditContext(dossier));
  return reportFromDossier(dossier, diagnostic, resolved.objectif);
}

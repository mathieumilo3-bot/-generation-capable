import { selectLeaksAndStrengths } from "./leaks";
import type { DeclaredInput, Finding, Report, SectorProfile, SiteSignals } from "./types";

export const ENGINE_VERSION = "1.0.0";

const UNREACHABLE_REASON_LABELS: Record<NonNullable<SiteSignals["unreachableReason"]>, string> = {
  invalid_url: "l'adresse fournie n'a pas pu être interprétée comme un site accessible",
  blocked_target: "l'adresse fournie ne correspond pas à un site public analysable",
  network_error: "le site n'a pas répondu à notre tentative de connexion",
  timeout: "le site a mis trop de temps à répondre",
  http_error: "le site a répondu avec une erreur",
  empty_body: "la page n'a renvoyé aucun contenu exploitable",
};

/** Turns the top leaks into a numbered, concrete action plan — one line per leak, in priority order. */
function buildActionPlan(topLeaks: Finding[]): Report["actionPlan"] {
  return topLeaks
    .filter((f) => f.recommendation)
    .map((finding, index) => ({
      order: index + 1,
      title: finding.title,
      recommendation: finding.recommendation!,
    }));
}

export function buildReport(
  input: DeclaredInput,
  site: SiteSignals,
  sector: SectorProfile,
  findings: Finding[]
): Report {
  const { topLeaks, worksWell, otherFindings } = selectLeaksAndStrengths(findings, sector);

  return {
    header: {
      entreprise: input.entreprise || input.siteUrl || "Entreprise analysée",
      secteur: input.secteur || sector.label,
      sectorProfile: sector.id,
      objectif: input.objectif,
      siteUrl: input.siteUrl,
      generatedAt: new Date().toISOString(),
      siteReachable: site.reachable,
    },
    topLeaks,
    worksWell,
    otherFindings,
    actionPlan: buildActionPlan(topLeaks),
    degraded: !site.reachable,
    degradedReason: site.reachable
      ? undefined
      : `Nous n'avons pas pu analyser directement votre site (${UNREACHABLE_REASON_LABELS[site.unreachableReason ?? "network_error"]}). Les recommandations ci-dessous s'appuient sur les priorités connues de votre secteur, pas sur une lecture de votre page.`,
    sectorNote: sector.limits,
    engineVersion: ENGINE_VERSION,
  };
}

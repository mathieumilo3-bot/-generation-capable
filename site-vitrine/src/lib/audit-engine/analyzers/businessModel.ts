import type { DeclaredInput, Finding, SectorProfile, SiteSignals } from "../types";

/**
 * Retention/LTV (dimension 15) and business model (dimension 16) — the two
 * dimensions the brief is most explicit about never fabricating: revenue,
 * repeat-purchase rate, channel dependency, scalability are all internal
 * metrics no public page reveals. This analyzer mostly reports UNKNOWN, and
 * only raises a finding on the rare signal that IS observable: a visible
 * subscription/recurring-purchase mechanism, or its complete absence for a
 * sector where it usually drives revenue.
 */
export function analyzeBusinessModel(_input: DeclaredInput, site: SiteSignals, sector: SectorProfile): Finding[] {
  const findings: Finding[] = [];
  if (!site.reachable) return findings;

  const recurrenceWords = ["abonnement", "adhésion", "membre", "forfait mensuel", "renouvellement"];
  const text = (site.title.value ?? "") + " " + (site.metaDescription.value ?? "") + " " + (site.h1.value?.join(" ") ?? "");
  const hasRecurrenceMention = recurrenceWords.some((w) => text.toLowerCase().includes(w));

  const recurrenceRelevantSectors = ["salle_de_sport", "saas_logiciel", "formation"];
  if (recurrenceRelevantSectors.includes(sector.id) && !hasRecurrenceMention) {
    findings.push({
      id: "business_model_recurrence_unclear",
      dimension: "business_model",
      title: "Le modèle d'abonnement ou d'adhésion n'est pas mis en avant",
      statement: `Pour ${sector.label.toLowerCase()}, la récurrence (abonnement, adhésion) est souvent un levier de revenu important. Aucune mention explicite de ce type n'a été détectée sur la page analysée — sans certitude sur votre modèle réel, qui reste à vérifier avec vous.`,
      evidence: ["Aucun mot-clé lié à l'abonnement/l'adhésion détecté dans le titre, la description ou les titres de la page."],
      confidence: "inferred",
      impact: 2,
      effort: 3,
      polarity: "negative",
      recommendation: "Si un modèle récurrent existe, le rendre visible et son bénéfice explicite.",
    });
  }

  // Nothing about actual revenue, retention rate, or channel dependency is
  // ever inferred here — those stay UNKNOWN by design, reported once at the
  // report level (see report.ts `structuralUnknowns`) rather than as a
  // per-finding placeholder that would just repeat "we don't know" five times.

  return findings;
}

import type { Dimension, Finding, SectorProfile } from "./types";

const MIN_LEAKS = 3;
const MAX_LEAKS = 5;
const MAX_WORKS_WELL = 3;

/**
 * How much a dimension typically weighs in a conversion journey, 1–5. This
 * is a general prior about where journeys usually break, not a claim about
 * this specific business — the sector-priority boost below is what makes
 * the scoring sector-aware.
 */
const DIMENSION_BASE_WEIGHT: Record<Dimension, number> = {
  conversion: 5,
  trust: 5,
  funnel: 4,
  positioning: 4,
  psychology: 3,
  social_proof: 3,
  offer: 3,
  acquisition: 2,
  price_value: 3,
  business_model: 2,
  retention: 2,
};

const CONFIDENCE_WEIGHT: Record<Finding["confidence"], number> = {
  observed: 1,
  inferred: 0.7,
  unknown: 0.5,
};

/**
 * Explicit, inspectable priority formula (brief §18):
 *   impact × importance-dans-le-parcours × confiance-dans-l'observation × facilité-de-correction
 * Every factor is already on a bounded scale (impact/effort 1–5, dimension
 * weight 1–5, confidence 0.5–1) — nothing here claims more mathematical
 * precision than the inputs actually carry; it's a sort key, not a metric.
 */
export function priorityScore(finding: Finding, sector: SectorProfile): number {
  const baseWeight = DIMENSION_BASE_WEIGHT[finding.dimension];
  const sectorBoost = sector.priorityDimensions.includes(finding.dimension) ? 1.3 : 1;
  const journeyImportance = Math.min(5, baseWeight * sectorBoost);
  const confidenceWeight = CONFIDENCE_WEIGHT[finding.confidence];
  const easeOfCorrection = finding.effort / 5;

  return (finding.impact / 5) * (journeyImportance / 5) * confidenceWeight * easeOfCorrection;
}

/** Keeps the single highest-scoring finding per dimension, preserving score order. */
function dedupeByDimension(scored: { finding: Finding; score: number }[]): { finding: Finding; score: number }[] {
  const seen = new Set<Dimension>();
  const result: { finding: Finding; score: number }[] = [];
  for (const entry of scored) {
    if (seen.has(entry.finding.dimension)) continue;
    seen.add(entry.finding.dimension);
    result.push(entry);
  }
  return result;
}

export type LeakSelection = {
  topLeaks: Finding[];
  worksWell: Finding[];
  otherFindings: Finding[];
};

/**
 * Selects the 3–5 leaks that matter most and up to 3 things that work,
 * from every finding the analyzers produced. Never invents a leak to reach
 * the floor: a genuinely clean audit can come back with fewer than three.
 */
export function selectLeaksAndStrengths(findings: Finding[], sector: SectorProfile): LeakSelection {
  const negative = findings.filter((f) => f.polarity === "negative");
  const positive = findings.filter((f) => f.polarity === "positive");

  const scoredNegative = negative
    .map((finding) => ({ finding, score: priorityScore(finding, sector) }))
    .sort((a, b) => b.score - a.score);
  const scoredPositive = positive
    .map((finding) => ({ finding, score: priorityScore(finding, sector) }))
    .sort((a, b) => b.score - a.score);

  const dedupedNegative = dedupeByDimension(scoredNegative);
  const topLeaks = dedupedNegative.slice(0, MAX_LEAKS).map((e) => e.finding);

  // If dedup-by-dimension left us short of the floor but more distinct
  // findings exist (a dimension can legitimately produce two real leaks —
  // e.g. "no HTTPS" and "no legal notice" both under trust), fill the rest
  // from the remaining highest-scoring findings regardless of dimension.
  if (topLeaks.length < Math.min(MIN_LEAKS, scoredNegative.length)) {
    const already = new Set(topLeaks.map((f) => f.id));
    for (const { finding } of scoredNegative) {
      if (topLeaks.length >= MIN_LEAKS) break;
      if (already.has(finding.id)) continue;
      topLeaks.push(finding);
      already.add(finding.id);
    }
  }

  const topLeakIds = new Set(topLeaks.map((f) => f.id));
  const otherFindings = findings.filter((f) => f.polarity === "negative" && !topLeakIds.has(f.id));

  const worksWell = dedupeByDimension(scoredPositive)
    .slice(0, MAX_WORKS_WELL)
    .map((e) => e.finding);

  return { topLeaks, worksWell, otherFindings };
}

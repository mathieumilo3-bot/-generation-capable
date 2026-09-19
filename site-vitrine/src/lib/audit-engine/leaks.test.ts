import { describe, expect, it } from "vitest";
import { priorityScore, selectLeaksAndStrengths } from "./leaks";
import { getSectorProfile } from "./sectors";
import type { Finding } from "./types";

function finding(overrides: Partial<Finding> & Pick<Finding, "id" | "dimension" | "polarity">): Finding {
  return {
    title: overrides.id,
    statement: "…",
    evidence: [],
    confidence: "observed",
    impact: 3,
    effort: 3,
    recommendation: overrides.polarity === "negative" ? "…" : undefined,
    ...overrides,
  };
}

const RESTAURANT = getSectorProfile("restaurant");
const DENTAL = getSectorProfile("dentiste_sante"); // priorityDimensions include trust, conversion, positioning

describe("priorityScore", () => {
  it("scores higher for higher impact, all else equal", () => {
    const low = finding({ id: "a", dimension: "conversion", polarity: "negative", impact: 1 });
    const high = finding({ id: "b", dimension: "conversion", polarity: "negative", impact: 5 });
    expect(priorityScore(high, RESTAURANT)).toBeGreaterThan(priorityScore(low, RESTAURANT));
  });

  it("scores higher for easier fixes, all else equal", () => {
    const hard = finding({ id: "a", dimension: "conversion", polarity: "negative", effort: 1 });
    const easy = finding({ id: "b", dimension: "conversion", polarity: "negative", effort: 5 });
    expect(priorityScore(easy, RESTAURANT)).toBeGreaterThan(priorityScore(hard, RESTAURANT));
  });

  it("discounts unknown-confidence findings relative to observed ones", () => {
    const observedF = finding({ id: "a", dimension: "trust", polarity: "negative", confidence: "observed" });
    const unknownF = finding({ id: "b", dimension: "trust", polarity: "negative", confidence: "unknown" });
    expect(priorityScore(observedF, RESTAURANT)).toBeGreaterThan(priorityScore(unknownF, RESTAURANT));
  });

  it("boosts a finding whose dimension is a stated priority for the sector", () => {
    const f = finding({ id: "a", dimension: "trust", polarity: "negative" });
    // trust is a priority dimension for dentiste_sante but not weighted
    // differently by base weight (already 5, max) — use "positioning"
    // instead, where the sector boost has room to matter.
    const positioning = finding({ id: "b", dimension: "positioning", polarity: "negative" });
    const scoreForDental = priorityScore(positioning, DENTAL); // positioning is a priority for dentiste_sante
    const scoreForRestaurant = priorityScore(positioning, RESTAURANT); // not a priority there
    expect(scoreForDental).toBeGreaterThan(scoreForRestaurant);
    void f;
  });

  it("never returns a negative or NaN score", () => {
    const f = finding({ id: "a", dimension: "retention", polarity: "negative", impact: 1, effort: 1, confidence: "unknown" });
    const score = priorityScore(f, RESTAURANT);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(score)).toBe(false);
  });
});

describe("selectLeaksAndStrengths", () => {
  it("returns between 3 and 5 leaks when at least 5 dimensions have a negative finding", () => {
    const findings: Finding[] = [
      finding({ id: "a", dimension: "conversion", polarity: "negative", impact: 5 }),
      finding({ id: "b", dimension: "trust", polarity: "negative", impact: 5 }),
      finding({ id: "c", dimension: "positioning", polarity: "negative", impact: 4 }),
      finding({ id: "d", dimension: "funnel", polarity: "negative", impact: 4 }),
      finding({ id: "e", dimension: "social_proof", polarity: "negative", impact: 3 }),
      finding({ id: "f", dimension: "offer", polarity: "negative", impact: 2 }),
    ];
    const { topLeaks } = selectLeaksAndStrengths(findings, RESTAURANT);
    expect(topLeaks.length).toBeGreaterThanOrEqual(3);
    expect(topLeaks.length).toBeLessThanOrEqual(5);
  });

  it("orders leaks by priority score, highest first", () => {
    const findings: Finding[] = [
      finding({ id: "low", dimension: "conversion", polarity: "negative", impact: 1, effort: 1 }),
      finding({ id: "high", dimension: "trust", polarity: "negative", impact: 5, effort: 5 }),
      finding({ id: "mid", dimension: "positioning", polarity: "negative", impact: 3, effort: 3 }),
    ];
    const { topLeaks } = selectLeaksAndStrengths(findings, RESTAURANT);
    expect(topLeaks[0].id).toBe("high");
  });

  it("never invents a leak — a clean audit can return fewer than 3", () => {
    const findings: Finding[] = [finding({ id: "only-one", dimension: "trust", polarity: "negative" })];
    const { topLeaks } = selectLeaksAndStrengths(findings, RESTAURANT);
    expect(topLeaks).toHaveLength(1);
    expect(topLeaks[0].id).toBe("only-one");
  });

  it("returns an empty leak list rather than fabricating one when there is nothing negative", () => {
    const findings: Finding[] = [finding({ id: "good", dimension: "trust", polarity: "positive" })];
    const { topLeaks } = selectLeaksAndStrengths(findings, RESTAURANT);
    expect(topLeaks).toEqual([]);
  });

  it("caps worksWell at 3 and dedupes by dimension", () => {
    const findings: Finding[] = [
      finding({ id: "p1", dimension: "trust", polarity: "positive", impact: 3 }),
      finding({ id: "p2", dimension: "trust", polarity: "positive", impact: 5 }), // higher score, same dimension
      finding({ id: "p3", dimension: "social_proof", polarity: "positive", impact: 2 }),
      finding({ id: "p4", dimension: "acquisition", polarity: "positive", impact: 2 }),
      finding({ id: "p5", dimension: "conversion", polarity: "positive", impact: 2 }),
    ];
    const { worksWell } = selectLeaksAndStrengths(findings, RESTAURANT);
    expect(worksWell.length).toBeLessThanOrEqual(3);
    // p2 should win over p1 within the "trust" dimension (higher impact).
    expect(worksWell.some((f) => f.id === "p2")).toBe(true);
    expect(worksWell.some((f) => f.id === "p1")).toBe(false);
  });

  it("puts every negative finding not promoted to topLeaks into otherFindings, none lost", () => {
    const findings: Finding[] = [
      finding({ id: "a", dimension: "conversion", polarity: "negative", impact: 5 }),
      finding({ id: "b", dimension: "trust", polarity: "negative", impact: 5 }),
      finding({ id: "c", dimension: "positioning", polarity: "negative", impact: 4 }),
      finding({ id: "d", dimension: "funnel", polarity: "negative", impact: 4 }),
      finding({ id: "e", dimension: "social_proof", polarity: "negative", impact: 3 }),
      finding({ id: "f", dimension: "offer", polarity: "negative", impact: 1 }),
      finding({ id: "g", dimension: "acquisition", polarity: "negative", impact: 1 }),
    ];
    const { topLeaks, otherFindings } = selectLeaksAndStrengths(findings, RESTAURANT);
    const allIds = new Set([...topLeaks.map((f) => f.id), ...otherFindings.map((f) => f.id)]);
    expect(allIds.size).toBe(findings.length);
  });
});

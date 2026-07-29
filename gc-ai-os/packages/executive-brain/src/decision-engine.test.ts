import { describe, expect, it } from "vitest";
import type { MetricReading } from "@gc-ai-os/metrics";
import { arbitrate, scoreProposal, TIE_THRESHOLD, DECISION_WEIGHTS } from "./decision-engine";
import type { BrainProposal } from "./types";

const measured: MetricReading = {
  metricId: "churn_rate",
  value: 8.2,
  measuredAt: "2026-07-29T00:00:00.000Z",
  source: "stripe",
};

function proposal(overrides: Partial<BrainProposal> = {}): BrainProposal {
  return {
    id: "p1",
    brainId: "cfo",
    title: "Titre",
    rationale: "Raison",
    targetMetricId: "churn_rate",
    effort: "medium",
    risk: "low",
    horizon: "month",
    alignment: 0.9,
    evidence: [],
    executionDomain: "finance",
    ...overrides,
  };
}

describe("confiance — mécanisme anti-hallucination", () => {
  it("plafonne une proposition sans preuve mesurée à faible confiance", () => {
    const scored = scoreProposal(proposal({ evidence: [] }));
    expect(scored.breakdown.confidence).toBe(0.25);
  });

  it("relève la confiance dès qu'une métrique réelle étaye la proposition", () => {
    const scored = scoreProposal(proposal({ evidence: [measured] }));
    expect(scored.breakdown.confidence).toBe(0.8);
  });

  it("ignore une preuve non mesurée dans le calcul de confiance", () => {
    const unmeasured: MetricReading = {
      metricId: "mrr",
      value: null,
      measuredAt: null,
      source: "unmeasured",
    };
    const scored = scoreProposal(proposal({ evidence: [unmeasured] }));
    expect(scored.breakdown.confidence).toBe(0.25);
  });

  it("fait gagner la proposition étayée contre l'identique sans preuve", () => {
    // C'est le comportement central du système : sans données, il
    // demande à instrumenter ; avec données, il décide.
    const result = arbitrate([
      proposal({ id: "sans-preuve", evidence: [] }),
      proposal({ id: "avec-preuve", evidence: [measured] }),
    ]);

    expect(result.winner?.proposal.id).toBe("avec-preuve");
  });
});

describe("arbitrate", () => {
  it("renvoie un verdict explicite quand il n'y a rien à arbitrer", () => {
    const result = arbitrate([]);
    expect(result.winner).toBeNull();
    expect(result.ranked).toHaveLength(0);
    expect(result.rationale).toContain("Aucune proposition");
  });

  it("signale les ex æquo comme contestés plutôt que de trancher au hasard", () => {
    const a = proposal({ id: "a", evidence: [measured] });
    const b = proposal({ id: "b", evidence: [measured] });
    const result = arbitrate([a, b]);

    expect(result.contested).toHaveLength(1);
    expect(result.rationale).toContain("délibération");
  });

  it("ne marque pas comme contestée une proposition nettement distancée", () => {
    const fort = proposal({ id: "fort", evidence: [measured], alignment: 1, horizon: "immediate" });
    const faible = proposal({ id: "faible", evidence: [], alignment: 0.2, horizon: "multi_year", risk: "high" });
    const result = arbitrate([fort, faible]);

    expect(result.winner?.proposal.id).toBe("fort");
    expect(result.contested).toHaveLength(0);
    expect(result.ranked[0]!.score - result.ranked[1]!.score).toBeGreaterThan(TIE_THRESHOLD);
  });

  it("est déterministe à score égal", () => {
    const items = [proposal({ id: "zzz" }), proposal({ id: "aaa" })];
    expect(arbitrate(items).winner?.proposal.id).toBe("aaa");
    expect(arbitrate(items).winner?.proposal.id).toBe("aaa");
  });
});

describe("ordre de priorité du manuel de direction", () => {
  it("fait passer une action de protection devant une optimisation équivalente", () => {
    const protection = proposal({ id: "secu", executionDomain: "securite", evidence: [measured] });
    const optimisation = proposal({ id: "opti", executionDomain: "recherche", evidence: [measured] });

    const result = arbitrate([optimisation, protection]);
    expect(result.winner?.proposal.id).toBe("secu");
  });

  it("expose la priorité dans l'explication", () => {
    const scored = scoreProposal(proposal({ executionDomain: "support-client" }));
    expect(scored.explanation).toContain("clients");
  });
});

describe("risque de l'inaction", () => {
  it("ne pénalise plus une action urgente et parfaitement alignée", () => {
    // Cas réel observé : une trésorerie critique (risque élevé, urgence
    // immédiate) passait derrière un problème moins grave.
    const urgente = proposal({ risk: "high", horizon: "immediate", alignment: 1 });
    const confortable = proposal({ risk: "high", horizon: "year", alignment: 1 });

    expect(scoreProposal(urgente).breakdown.safety).toBeGreaterThan(
      scoreProposal(confortable).breakdown.safety,
    );
  });

  it("laisse une action risquée non urgente pleinement pénalisée", () => {
    const scored = scoreProposal(proposal({ risk: "high", horizon: "year", alignment: 1 }));
    expect(scored.breakdown.safety).toBe(0);
  });
});

describe("pondérations", () => {
  it("somment à 1", () => {
    const total = Object.values(DECISION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

import { describe, expect, it } from "vitest";
import type { AgentManifest, AgentSkill, Mission } from "@gc-ai-os/shared-types";
import { scoreCandidates, WEIGHTS } from "./scoring";

function manifest(id: string, domain: string): AgentManifest {
  return {
    id,
    name: id,
    domain,
    role: "test",
    responsibilities: [],
    tools: [],
    memory: { scope: "agent", readAccess: [] },
    model: "test",
  };
}

function skill(agentId: string, overrides: Partial<AgentSkill> = {}): AgentSkill {
  return {
    agentId,
    skill: "s",
    level: 50,
    runs: 0,
    successes: 0,
    avgDurationMs: 0,
    avgCostMicros: 0,
    lastUsedAt: null,
    ...overrides,
  };
}

const mission: Mission = {
  id: "m1",
  objectiveId: "o1",
  title: "t",
  brief: "b",
  domain: "marketing",
  requiredSkill: "s",
  status: "pending",
  dependsOn: [],
  attempt: 0,
  maxAttempts: 2,
  assignedAgentId: null,
  riskLevel: "low",
  acceptanceCriteria: "c",
  createdAt: "",
  updatedAt: "",
};

describe("scoreCandidates", () => {
  it("place l'agent du bon domaine devant un agent hors domaine plus rapide", () => {
    // Le domaine pèse 0,40 : un agent hors domaine ne doit pas gagner
    // sur sa seule rapidité.
    const ranked = scoreCandidates(mission, [
      { manifest: manifest("hors-domaine", "finance"), skill: skill("hors-domaine", { avgDurationMs: 10 }) },
      { manifest: manifest("bon-domaine", "marketing"), skill: skill("bon-domaine", { avgDurationMs: 5000 }) },
    ]);

    expect(ranked[0]!.agentId).toBe("bon-domaine");
  });

  it("départage deux agents du même domaine par la fiabilité mesurée", () => {
    const ranked = scoreCandidates(mission, [
      { manifest: manifest("novice", "marketing"), skill: skill("novice") },
      {
        manifest: manifest("eprouve", "marketing"),
        skill: skill("eprouve", { runs: 20, successes: 19, level: 95 }),
      },
    ]);

    expect(ranked[0]!.agentId).toBe("eprouve");
    expect(ranked[0]!.breakdown.reliability).toBeGreaterThan(ranked[1]!.breakdown.reliability);
  });

  it("est déterministe : deux exécutions identiques donnent le même ordre", () => {
    const candidates = [
      { manifest: manifest("b-agent", "marketing"), skill: skill("b-agent") },
      { manifest: manifest("a-agent", "marketing"), skill: skill("a-agent") },
    ];

    const first = scoreCandidates(mission, candidates).map((c) => c.agentId);
    const second = scoreCandidates(mission, candidates).map((c) => c.agentId);

    expect(first).toEqual(second);
    // À score égal, l'identifiant tranche — jamais l'ordre d'insertion.
    expect(first[0]).toBe("a-agent");
  });

  it("n'accorde pas un score parfait de vitesse à un agent jamais mesuré", () => {
    // « Jamais mesuré » ne doit pas valoir « instantané et gratuit ».
    const ranked = scoreCandidates(mission, [
      { manifest: manifest("neuf", "marketing"), skill: skill("neuf") },
    ]);

    expect(ranked[0]!.breakdown.speed).toBe(0.5);
    expect(ranked[0]!.breakdown.costEfficiency).toBe(0.5);
  });

  it("garde des pondérations qui somment à 1", () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

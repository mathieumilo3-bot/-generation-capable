import { describe, expect, it } from "vitest";
import type { AgentSkill } from "@gc-ai-os/shared-types";
import { SkillRegistry, coldStartSkill, reliabilityOf, type SkillRepository } from "./index";

function memoryRepository(): SkillRepository & { rows: Map<string, AgentSkill> } {
  const rows = new Map<string, AgentSkill>();
  const key = (a: string, s: string) => `${a}::${s}`;
  return {
    rows,
    async get(agentId, skill) {
      return rows.get(key(agentId, skill));
    },
    async listForSkill(skill) {
      return [...rows.values()].filter((r) => r.skill === skill);
    },
    async listForAgent(agentId) {
      return [...rows.values()].filter((r) => r.agentId === agentId);
    },
    async upsert(record) {
      rows.set(key(record.agentId, record.skill), record);
    },
  };
}

describe("reliabilityOf — lissage de Laplace", () => {
  it("place un agent sans historique à 0,5 exactement", () => {
    // Ni favorisé (il gagnerait sans preuve) ni exclu (il ne pourrait
    // jamais faire ses preuves).
    expect(reliabilityOf({ runs: 0, successes: 0 })).toBe(0.5);
  });

  it("ne donne pas 1,0 après un seul succès", () => {
    // La confiance se gagne progressivement : c'est ce qui empêche un
    // coup de chance de dominer un agent éprouvé.
    expect(reliabilityOf({ runs: 1, successes: 1 })).toBeCloseTo(0.667, 3);
  });

  it("converge vers le taux réel avec le volume", () => {
    expect(reliabilityOf({ runs: 100, successes: 90 })).toBeCloseTo(0.892, 3);
  });

  it("ne descend jamais à 0 même après des échecs répétés", () => {
    expect(reliabilityOf({ runs: 10, successes: 0 })).toBeGreaterThan(0);
  });
});

describe("SkillRegistry", () => {
  it("renvoie une compétence à froid plutôt qu'undefined", async () => {
    const registry = new SkillRegistry(memoryRepository());
    const skill = await registry.get("agent-x", "competence-y");
    expect(skill).toEqual(coldStartSkill("agent-x", "competence-y"));
    expect(skill.level).toBe(50);
  });

  it("dérive le niveau du taux de succès, jamais d'une saisie", async () => {
    const registry = new SkillRegistry(memoryRepository());
    const updated = await registry.record({
      agentId: "a",
      skill: "s",
      success: true,
      durationMs: 100,
      costMicros: 1000,
    });

    expect(updated.runs).toBe(1);
    expect(updated.successes).toBe(1);
    expect(updated.level).toBe(67); // round(0.667 * 100)
  });

  it("fait baisser le niveau après un échec", async () => {
    const registry = new SkillRegistry(memoryRepository());
    await registry.record({ agentId: "a", skill: "s", success: true, durationMs: 10, costMicros: 1 });
    const after = await registry.record({
      agentId: "a",
      skill: "s",
      success: false,
      durationMs: 10,
      costMicros: 1,
    });

    expect(after.runs).toBe(2);
    expect(after.successes).toBe(1);
    expect(after.level).toBe(50); // (1+1)/(2+2)
  });

  it("calcule une moyenne glissante correcte sur la durée", async () => {
    const registry = new SkillRegistry(memoryRepository());
    await registry.record({ agentId: "a", skill: "s", success: true, durationMs: 100, costMicros: 0 });
    const after = await registry.record({
      agentId: "a",
      skill: "s",
      success: true,
      durationMs: 300,
      costMicros: 0,
    });

    expect(after.avgDurationMs).toBe(200);
  });
});

import { describe, expect, it } from "vitest";
import type { Mission } from "@gc-ai-os/shared-types";
import { buildBatches, CyclicDependencyError } from "./scheduler";

function mission(id: string, dependsOn: string[] = []): Mission {
  return {
    id,
    objectiveId: "o1",
    title: id,
    brief: "",
    domain: "strategie",
    requiredSkill: "s",
    status: "pending",
    dependsOn,
    attempt: 0,
    maxAttempts: 2,
    assignedAgentId: null,
    riskLevel: "low",
    acceptanceCriteria: "",
    createdAt: "",
    updatedAt: "",
  };
}

describe("buildBatches — exécution parallèle par vagues", () => {
  it("met les missions indépendantes dans une seule vague", () => {
    const batches = buildBatches([mission("a"), mission("b"), mission("c")]);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.missions).toHaveLength(3);
  });

  it("respecte l'ordre des dépendances", () => {
    const batches = buildBatches([
      mission("c", ["b"]),
      mission("b", ["a"]),
      mission("a"),
    ]);

    expect(batches.map((b) => b.missions.map((m) => m.id))).toEqual([["a"], ["b"], ["c"]]);
  });

  it("regroupe les missions qui partagent la même dépendance", () => {
    // b et c dépendent tous deux de a : ils doivent partir ensemble,
    // sinon l'exécution est séquentielle déguisée en parallèle.
    const batches = buildBatches([mission("a"), mission("b", ["a"]), mission("c", ["a"])]);

    expect(batches).toHaveLength(2);
    expect(batches[1]!.missions.map((m) => m.id).sort()).toEqual(["b", "c"]);
  });

  it("ignore une dépendance vers une mission absente du lot", () => {
    // Cas réel : reprise d'un objectif dont une partie est déjà
    // terminée. La dépendance satisfaite ne doit pas bloquer.
    const batches = buildBatches([mission("b", ["deja-terminee"])]);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.missions[0]!.id).toBe("b");
  });

  it("lève une erreur explicite sur un cycle plutôt que de boucler", () => {
    expect(() => buildBatches([mission("a", ["b"]), mission("b", ["a"])])).toThrow(
      CyclicDependencyError,
    );
  });

  it("détecte une auto-dépendance", () => {
    expect(() => buildBatches([mission("a", ["a"])])).toThrow(CyclicDependencyError);
  });

  it("gère un lot vide", () => {
    expect(buildBatches([])).toEqual([]);
  });

  it("n'oublie aucune mission", () => {
    const missions = [
      mission("a"),
      mission("b", ["a"]),
      mission("c", ["a"]),
      mission("d", ["b", "c"]),
    ];
    const scheduled = buildBatches(missions).flatMap((b) => b.missions.map((m) => m.id));

    expect(scheduled.sort()).toEqual(["a", "b", "c", "d"]);
  });
});

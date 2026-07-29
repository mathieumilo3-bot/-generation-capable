import { describe, expect, it } from "vitest";
import { MetricRegistry, type MetricDefinition, type MetricReading, type MetricRepository } from "@gc-ai-os/metrics";
import { computeEnterpriseScore } from "./enterprise-score";

function repository(values: Record<string, number>): MetricRepository {
  return {
    async latest(metricId) {
      const value = values[metricId];
      return value === undefined
        ? undefined
        : { metricId, value, measuredAt: new Date().toISOString(), source: "manual" };
    },
    async record() {},
    async listLatest() {
      return [];
    },
  };
}

function metric(id: string, domain: MetricDefinition["domain"], target: number, higherIsBetter: boolean): MetricDefinition {
  return { id, label: id, unit: "u", domain, source: "manual", higherIsBetter, target, freshnessHours: 24 };
}

/**
 * Catalogue de test couvrant les 8 domaines.
 *
 * `computeEnterpriseScore` itère toujours les 8 domaines connus, pas
 * seulement ceux présents dans le catalogue : un catalogue plus étroit
 * ne peut jamais atteindre le seuil de représentativité. C'est le
 * premier test qui l'a mis en évidence.
 */
const catalogue: MetricDefinition[] = [
  metric("churn", "cfo", 5, false),
  metric("runway", "cfo", 12, true),
  metric("bugs", "cto", 20, false),
  metric("growth", "ceo", 10, true),
  metric("blocked", "coo", 0, false),
  metric("reach", "cmo", 100, true),
  metric("conversion", "cro", 3, true),
  metric("onboarding", "chro", 80, true),
  metric("position", "strategy", 3, false),
];

/** Alimente tous les domaines à une valeur atteignant leur cible. */
const ALL_AT_TARGET = {
  churn: 2, runway: 24, bugs: 10, growth: 20,
  blocked: 0, reach: 200, conversion: 5, onboarding: 90, position: 1,
};

describe("computeEnterpriseScore — honnêteté des chiffres", () => {
  it("laisse un département sans données à null, jamais à 0", () => {
    // « Pas de données » et « mauvais résultat » ne doivent jamais être
    // confondus : c'est toute la raison d'être de ce module.
    return computeEnterpriseScore(new MetricRegistry(repository({}), catalogue)).then((score) => {
      const cto = score.domains.find((d) => d.domain === "cto");
      expect(cto?.score).toBeNull();
      expect(cto?.measuredCount).toBe(0);
    });
  });

  it("ne calcule aucune note globale quand rien n'est mesuré", async () => {
    const score = await computeEnterpriseScore(new MetricRegistry(repository({}), catalogue));
    expect(score.overall).toBeNull();
    expect(score.riskPercent).toBeNull();
    expect(score.headline).toContain("aucune métrique");
  });

  it("masque la note globale sous le seuil de représentativité", async () => {
    // Un seul département noté sur deux : afficher une moyenne donnerait
    // une fausse impression de maîtrise.
    const score = await computeEnterpriseScore(
      new MetricRegistry(repository({ churn: 2, runway: 24 }), catalogue),
    );

    expect(score.domains.find((d) => d.domain === "cfo")?.score).toBe(100);
    expect(score.overall).toBeNull();
    expect(score.headline).toContain("fausse impression");
  });

  it("calcule une note globale dès que la couverture est suffisante", async () => {
    const score = await computeEnterpriseScore(
      new MetricRegistry(repository(ALL_AT_TARGET), catalogue),
    );

    expect(score.overall).toBe(100);
    expect(score.riskPercent).toBe(0);
  });

  it("note correctement une métrique au-delà de sa cible", async () => {
    // Churn 10 % pour une cible de 5 % → 5/10 = 0,5
    const score = await computeEnterpriseScore(
      new MetricRegistry(repository({ churn: 10, runway: 12, bugs: 20 }), catalogue),
    );

    const cfo = score.domains.find((d) => d.domain === "cfo");
    expect(cfo?.score).toBe(75); // (0,5 + 1,0) / 2
  });

  it("plafonne à 100 un dépassement de cible", async () => {
    const score = await computeEnterpriseScore(
      new MetricRegistry(repository({ ...ALL_AT_TARGET, runway: 9999, reach: 99999 }), catalogue),
    );
    expect(score.overall).toBe(100);
  });
});

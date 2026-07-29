import type { BrainDomain, MetricDefinition, MetricReading, MetricRegistry } from "@gc-ai-os/metrics";

export interface DomainScore {
  domain: BrainDomain;
  label: string;
  /** `null` = non mesuré. Jamais remplacé par 0 ni par une estimation. */
  score: number | null;
  coverage: number;
  measuredCount: number;
  totalCount: number;
}

export interface EnterpriseScore {
  domains: DomainScore[];
  /** Note globale, ou `null` si rien n'est mesuré. */
  overall: number | null;
  /** Part du catalogue réellement alimentée, sur [0,1]. */
  coverage: number;
  /** Risque estimé, en %. `null` tant qu'il n'y a rien à évaluer. */
  riskPercent: number | null;
  headline: string;
}

/**
 * Part minimale de départements notables pour qu'une note globale ait un
 * sens. En dessous, la moyenne ne représente pas l'entreprise.
 */
const MIN_DOMAIN_COVERAGE = 0.5;

const LABELS: Record<BrainDomain, string> = {
  ceo: "Croissance",
  coo: "Opérations",
  cto: "Développement",
  cfo: "Finance",
  cmo: "Marketing",
  cro: "Commercial",
  chro: "Équipe",
  strategy: "Stratégie",
};

/**
 * Note une métrique sur [0,1] par rapport à sa cible.
 *
 * Sans cible définie, on ne fabrique pas de note : la métrique est
 * comptée comme mesurée mais n'entre pas dans le score. Noter « 15 bugs
 * ouverts » sans savoir combien est acceptable produirait un chiffre
 * arbitraire présenté comme une évaluation.
 */
function scoreMetric(definition: MetricDefinition, reading: MetricReading): number | null {
  if (reading.value === null || definition.target === undefined) return null;

  const { value } = reading;
  const { target, higherIsBetter } = definition;

  if (higherIsBetter) {
    if (target <= 0) return null;
    return Math.max(0, Math.min(1, value / target));
  }

  if (value <= target) return 1;
  if (target <= 0) return value === 0 ? 1 : 0;
  return Math.max(0, Math.min(1, target / value));
}

/**
 * GC Enterprise Score (voir docs/gc-ai-os/14-executive-brain.md).
 *
 * Règle non négociable : **aucun département ne reçoit de note tant que
 * ses métriques ne sont pas alimentées.** Un tableau affichant
 * « Marketing : 95 » sans source est pire qu'un tableau vide — il crée
 * une confiance que rien ne justifie et oriente des décisions réelles
 * sur du vide. « Non mesuré » est donc une valeur affichable, et c'est
 * elle qui indique le prochain chantier utile.
 */
export async function computeEnterpriseScore(registry: MetricRegistry): Promise<EnterpriseScore> {
  const domains: DomainScore[] = [];

  for (const domain of Object.keys(LABELS) as BrainDomain[]) {
    const definitions = registry.definitions(domain);
    const readings = await Promise.all(definitions.map((d) => registry.read(d.id)));

    const measuredCount = readings.filter((r) => r.value !== null).length;

    const scores = definitions
      .map((definition, index) => scoreMetric(definition, readings[index]!))
      .filter((score): score is number => score !== null);

    domains.push({
      domain,
      label: LABELS[domain],
      score: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : null,
      coverage: definitions.length > 0 ? measuredCount / definitions.length : 0,
      measuredCount,
      totalCount: definitions.length,
    });
  }

  const scored = domains.filter((d): d is DomainScore & { score: number } => d.score !== null);

  // Une note globale calculée sur une poignée de départements est
  // trompeuse : afficher « 100/100 » alors qu'un seul département sur
  // huit est mesuré donne exactement la fausse confiance que ce module
  // cherche à empêcher. En dessous du seuil de représentativité, on
  // n'affiche pas de note globale — les notes par département, elles,
  // restent visibles et exactes.
  const overall =
    scored.length >= Math.ceil(domains.length * MIN_DOMAIN_COVERAGE)
      ? Math.round(scored.reduce((sum, d) => sum + d.score, 0) / scored.length)
      : null;

  const coverage = await registry.coverage();

  return {
    domains,
    overall,
    coverage,
    riskPercent: overall === null ? null : Math.max(0, 100 - overall),
    headline: headlineFor(overall, coverage, scored.length, domains.length),
  };
}

function headlineFor(
  overall: number | null,
  coverage: number,
  scoredDomains: number,
  totalDomains: number,
): string {
  if (overall === null && scoredDomains === 0) {
    return (
      `Aucune note d'entreprise ne peut être calculée : aucune métrique du catalogue n'est ` +
      `alimentée. Ce n'est pas un mauvais résultat, c'est une absence de mesure — et c'est ` +
      `le premier chantier.`
    );
  }
  if (overall === null) {
    return (
      `Pas de note globale : seuls ${scoredDomains}/${totalDomains} départements sont notables ` +
      `(${Math.round(coverage * 100)} % du catalogue alimenté). Une moyenne sur si peu de ` +
      `départements donnerait une fausse impression de maîtrise — les notes par département ` +
      `ci-dessous, elles, sont exactes.`
    );
  }
  return (
    `Note globale ${overall}/100 sur ${scoredDomains}/${totalDomains} départements notés ` +
    `(${Math.round(coverage * 100)} % du catalogue de métriques alimenté). Les départements ` +
    `non notés le sont par manque de données, pas par absence de résultat.`
  );
}

export { LABELS as DOMAIN_LABELS };

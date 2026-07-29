import { randomUUID } from "node:crypto";
import type { BrainDomain, MetricDefinition, MetricReading, MetricRegistry } from "@gc-ai-os/metrics";
import type { BrainProposal, BrainReport, Effort, Horizon, Risk } from "./types";

/**
 * Règle de proposition d'un Brain : quand la métrique observée franchit
 * un seuil, la proposition correspondante est produite.
 *
 * Ce sont des règles métier explicites plutôt qu'un prompt libre. Un
 * Brain doit pouvoir répondre « pourquoi proposes-tu ça ? » par « parce
 * que le taux de résiliation dépasse 5 % », pas par « le modèle a jugé
 * que ». Le modèle intervient plus tard, pour rédiger l'argumentaire —
 * pas pour décider s'il y a un problème.
 */
export interface ProposalRule {
  /** Métrique observée. */
  watch: string;
  /** Déclenche si la valeur mesurée satisfait ce prédicat. */
  when: (value: number) => boolean;
  title: string;
  rationale: (value: number) => string;
  targetMetricId: string;
  executionDomain: string;
  effort: Effort;
  risk: Risk;
  horizon: Horizon;
  alignment: number;
}

export interface BrainDefinition {
  id: BrainDomain;
  label: string;
  mandate: string;
  rules: ProposalRule[];
  /**
   * Proposition émise quand le domaine n'a aucune métrique alimentée.
   * Instrumenter est alors la seule action honnête possible.
   */
  instrumentationProposal: {
    title: string;
    executionDomain: string;
  };
}

const pct = (v: number) => `${v.toFixed(1)} %`;

/**
 * Les huit Executive Brains (voir docs/gc-ai-os/14-executive-brain.md).
 *
 * Chacun est défini par son **périmètre de données**, pas par une
 * personnalité. Un CFO Brain n'est utile que s'il voit des chiffres
 * Stripe que le CEO Brain ne regarde pas — c'est la perspective
 * instrumentée qui crée la valeur, pas le rôle joué.
 */
export const EXECUTIVE_BRAINS: BrainDefinition[] = [
  {
    id: "ceo",
    label: "CEO Brain",
    mandate: "Vision, priorités, arbitrage inter-domaines",
    instrumentationProposal: { title: "Brancher Stripe pour connaître le nombre réel de clients", executionDomain: "backend" },
    rules: [
      {
        watch: "growth_rate",
        when: (v) => v < 5,
        title: "Relancer la croissance : elle est sous le seuil de viabilité",
        rationale: (v) => `Croissance mensuelle à ${pct(v)}, sous le seuil de 5 % nécessaire pour atteindre les objectifs annuels.`,
        targetMetricId: "growth_rate",
        executionDomain: "strategie",
        effort: "high",
        risk: "medium",
        horizon: "year",
        alignment: 1,
      },
    ],
  },
  {
    id: "coo",
    label: "COO Brain",
    mandate: "Opérations : qui est bloqué, quoi avance, redistribution",
    instrumentationProposal: { title: "Exposer les compteurs de missions pour piloter les opérations", executionDomain: "donnees" },
    rules: [
      {
        watch: "missions_blocked",
        when: (v) => v > 0,
        title: "Débloquer les missions en échec",
        rationale: (v) => `${v} mission(s) bloquée(s) ou échouée(s). Chaque mission bloquée immobilise une partie du plan.`,
        targetMetricId: "missions_blocked",
        executionDomain: "strategie",
        effort: "low",
        risk: "low",
        horizon: "immediate",
        alignment: 0.8,
      },
      {
        watch: "pending_validations",
        when: (v) => v > 0,
        title: "Traiter les validations humaines en attente",
        rationale: (v) => `${v} action(s) critique(s) attendent une approbation. Rien ne s'exécutera tant qu'un humain n'aura pas tranché.`,
        targetMetricId: "pending_validations",
        executionDomain: "strategie",
        effort: "low",
        risk: "low",
        horizon: "immediate",
        alignment: 0.9,
      },
      {
        watch: "agent_success_rate",
        when: (v) => v < 70,
        title: "Investiguer la baisse de fiabilité des agents",
        rationale: (v) => `Taux de succès des agents à ${pct(v)}. Sous 70 %, le coût de reprise dépasse le gain d'automatisation.`,
        targetMetricId: "agent_success_rate",
        executionDomain: "qualite",
        effort: "medium",
        risk: "low",
        horizon: "month",
        alignment: 0.7,
      },
    ],
  },
  {
    id: "cto",
    label: "CTO Brain",
    mandate: "Code, bugs, sécurité, performance, dette technique",
    instrumentationProposal: { title: "Brancher GitHub pour suivre bugs, déploiements et incidents", executionDomain: "infrastructure" },
    rules: [
      {
        watch: "security_advisories",
        when: (v) => v > 0,
        title: "Traiter les alertes de sécurité ouvertes",
        rationale: (v) => `${v} alerte(s) de sécurité non traitée(s). Une faille exploitée coûte plus qu'un sprint de correction.`,
        targetMetricId: "security_advisories",
        executionDomain: "securite",
        effort: "medium",
        risk: "low",
        horizon: "immediate",
        alignment: 0.95,
      },
      {
        watch: "production_incidents",
        when: (v) => v > 2,
        title: "Stabiliser la production avant d'ajouter des fonctionnalités",
        rationale: (v) => `${v} incidents en production. Au-delà de 2, la fiabilité perçue se dégrade plus vite que la valeur ajoutée.`,
        targetMetricId: "production_incidents",
        executionDomain: "qualite",
        effort: "high",
        risk: "medium",
        horizon: "month",
        alignment: 0.85,
      },
      {
        watch: "open_bugs",
        when: (v) => v > 20,
        title: "Réduire la dette de bugs ouverts",
        rationale: (v) => `${v} bugs ouverts. Le volume commence à masquer les régressions réelles.`,
        targetMetricId: "open_bugs",
        executionDomain: "qualite",
        effort: "medium",
        risk: "low",
        horizon: "month",
        alignment: 0.6,
      },
    ],
  },
  {
    id: "cfo",
    label: "CFO Brain",
    mandate: "Stripe, abonnements, trésorerie, coûts IA, rentabilité",
    instrumentationProposal: { title: "Brancher Stripe pour suivre MRR, abonnements et résiliations", executionDomain: "backend" },
    rules: [
      {
        watch: "churn_rate",
        when: (v) => v > 5,
        title: "Enrayer la résiliation avant d'investir en acquisition",
        rationale: (v) => `Résiliation mensuelle à ${pct(v)}. Au-delà de 5 %, chaque euro d'acquisition remplit un seau percé.`,
        targetMetricId: "churn_rate",
        executionDomain: "succes-client",
        effort: "medium",
        risk: "low",
        horizon: "month",
        alignment: 0.9,
      },
      {
        watch: "cash_runway",
        when: (v) => v < 6,
        title: "Sécuriser la trésorerie",
        rationale: (v) => `Trésorerie à ${v.toFixed(1)} mois. Sous 6 mois, les décisions d'investissement doivent être gelées.`,
        targetMetricId: "cash_runway",
        executionDomain: "finance",
        effort: "high",
        risk: "high",
        horizon: "immediate",
        alignment: 1,
      },
      {
        watch: "ai_cost",
        when: (v) => v > 500,
        title: "Maîtriser le coût d'infrastructure IA",
        rationale: (v) => `Coût IA mensuel à ${v.toFixed(0)} €. À surveiller avant qu'il ne pèse sur la marge unitaire.`,
        targetMetricId: "ai_cost",
        executionDomain: "finance",
        effort: "low",
        risk: "low",
        horizon: "month",
        alignment: 0.5,
      },
    ],
  },
  {
    id: "cmo",
    label: "CMO Brain",
    mandate: "TikTok, Instagram, YouTube, SEO, publicité, contenus",
    instrumentationProposal: { title: "Brancher les statistiques réseaux sociaux pour piloter le contenu", executionDomain: "marketing" },
    rules: [
      {
        watch: "content_published",
        when: (v) => v < 5,
        title: "Augmenter la cadence de publication",
        rationale: (v) => `${v} publication(s) cette semaine. La visibilité organique s'effondre en dessous d'une cadence régulière.`,
        targetMetricId: "content_published",
        executionDomain: "contenu",
        effort: "medium",
        risk: "low",
        horizon: "month",
        alignment: 0.7,
      },
      {
        watch: "visitor_to_signup",
        when: (v) => v < 3,
        title: "Optimiser la conversion visiteur → inscription",
        rationale: (v) => `Conversion à ${pct(v)}. Améliorer le tunnel coûte moins cher que d'acheter plus de trafic.`,
        targetMetricId: "visitor_to_signup",
        executionDomain: "marketing",
        effort: "medium",
        risk: "low",
        horizon: "month",
        alignment: 0.85,
      },
      {
        watch: "cac",
        when: (v) => v > 67,
        title: "Réduire le coût d'acquisition sous le prix de l'abonnement",
        rationale: (v) => `Coût d'acquisition à ${v.toFixed(0)} €, au-dessus des 67 € de l'abonnement mensuel : la rentabilité dépend entièrement de la durée de vie du client.`,
        targetMetricId: "cac",
        executionDomain: "marketing",
        effort: "high",
        risk: "medium",
        horizon: "month",
        alignment: 0.8,
      },
    ],
  },
  {
    id: "cro",
    label: "CRO Brain",
    mandate: "Vendeurs, ambassadeurs, directeurs, commissions, activité",
    instrumentationProposal: { title: "Exposer l'activité des ambassadeurs depuis Supabase", executionDomain: "base-de-donnees" },
    rules: [
      {
        watch: "inactive_ambassadors",
        when: (v) => v > 0,
        title: "Relancer les ambassadeurs inactifs",
        rationale: (v) => `${v} ambassadeur(s) sans activité depuis 7 jours. Un ambassadeur inactif deux semaines ne revient presque jamais.`,
        targetMetricId: "active_ambassadors",
        executionDomain: "commercial",
        effort: "low",
        risk: "low",
        horizon: "immediate",
        alignment: 0.9,
      },
      {
        watch: "ambassador_conversion",
        when: (v) => v < 3.4,
        title: "Améliorer la conversion des ambassadeurs",
        rationale: (v) => `Conversion ambassadeurs à ${pct(v)}. Chaque dixième de point se répercute directement sur le revenu.`,
        targetMetricId: "ambassador_conversion",
        executionDomain: "commercial",
        effort: "medium",
        risk: "low",
        horizon: "month",
        alignment: 0.9,
      },
    ],
  },
  {
    id: "chro",
    label: "CHRO Brain",
    mandate: "Effectif, recrutement, onboarding, montée en compétence",
    instrumentationProposal: { title: "Suivre la complétion de l'onboarding des nouveaux entrants", executionDomain: "recrutement" },
    rules: [
      {
        watch: "onboarding_completion",
        when: (v) => v < 70,
        title: "Corriger l'onboarding : trop d'abandons en cours de parcours",
        rationale: (v) => `Complétion de l'onboarding à ${pct(v)}. Recruter davantage ne sert à rien tant que le parcours d'entrée perd les nouveaux.`,
        targetMetricId: "onboarding_completion",
        executionDomain: "recrutement",
        effort: "medium",
        risk: "low",
        horizon: "month",
        alignment: 0.75,
      },
    ],
  },
  {
    id: "strategy",
    label: "Chief Strategy Brain",
    mandate: "Positionnement, concurrence, horizons longs",
    instrumentationProposal: { title: "Structurer une veille concurrentielle exploitable", executionDomain: "recherche" },
    rules: [],
  },
];

/**
 * Exécute les Brains sur l'état courant des métriques.
 *
 * Un Brain sans donnée ne bluffe pas : il émet une unique proposition
 * d'instrumentation et le dit dans son constat. C'est l'application
 * directe du principe du substrat de métriques — « inconnu » n'est pas
 * « rien à signaler ».
 */
export async function runBrains(registry: MetricRegistry): Promise<BrainReport[]> {
  return Promise.all(EXECUTIVE_BRAINS.map((brain) => runBrain(brain, registry)));
}

async function runBrain(brain: BrainDefinition, registry: MetricRegistry): Promise<BrainReport> {
  const readings = await registry.readDomain(brain.id);
  const coverage = await registry.coverage(brain.id);
  const measured = new Map(
    readings.filter((r) => r.value !== null).map((r) => [r.metricId, r] as const),
  );

  const proposals: BrainProposal[] = [];

  for (const rule of brain.rules) {
    const reading = measured.get(rule.watch);
    if (!reading || reading.value === null || !rule.when(reading.value)) continue;

    proposals.push({
      id: randomUUID(),
      brainId: brain.id,
      title: rule.title,
      rationale: rule.rationale(reading.value),
      targetMetricId: rule.targetMetricId,
      effort: rule.effort,
      risk: rule.risk,
      horizon: rule.horizon,
      alignment: rule.alignment,
      evidence: [reading],
      executionDomain: rule.executionDomain,
    });
  }

  if (measured.size === 0) {
    proposals.push({
      id: randomUUID(),
      brainId: brain.id,
      title: brain.instrumentationProposal.title,
      rationale:
        `Aucune métrique de ce domaine n'est alimentée : ce Brain ne peut rien observer. ` +
        `Instrumenter est la seule action utile — toute autre recommandation serait une supposition.`,
      targetMetricId: readings[0]?.metricId ?? "",
      effort: "medium",
      risk: "low",
      horizon: "immediate",
      alignment: 0.8,
      evidence: [],
      executionDomain: brain.instrumentationProposal.executionDomain,
    });
  }

  return {
    brainId: brain.id,
    label: brain.label,
    coverage,
    readings,
    proposals,
    assessment: assess(brain, measured.size, readings.length, proposals.length),
  };
}

function assess(
  brain: BrainDefinition,
  measuredCount: number,
  totalCount: number,
  proposalCount: number,
): string {
  if (measuredCount === 0) {
    return (
      `${brain.label} — aucune donnée disponible (0/${totalCount} métriques alimentées). ` +
      `Aucun constat ne peut être formulé sur ce domaine tant qu'une source n'est pas branchée.`
    );
  }
  if (proposalCount === 0) {
    return (
      `${brain.label} — ${measuredCount}/${totalCount} métriques mesurées, aucun seuil d'alerte franchi. ` +
      `Rien ne requiert d'arbitrage aujourd'hui sur ce domaine.`
    );
  }
  return (
    `${brain.label} — ${measuredCount}/${totalCount} métriques mesurées, ` +
    `${proposalCount} point(s) d'attention identifié(s).`
  );
}

export type { MetricDefinition };

import type { BrainDomain, MetricReading } from "@gc-ai-os/metrics";

export type Effort = "low" | "medium" | "high";
export type Risk = "low" | "medium" | "high";
export type Horizon = "immediate" | "month" | "year" | "multi_year";

/**
 * Proposition d'un Executive Brain.
 *
 * Point clé : `evidence` porte les lectures de métriques qui fondent la
 * proposition. Une proposition sans preuve mesurée n'est pas interdite —
 * elle obtient simplement une confiance faible dans l'arbitrage (voir
 * DecisionEngine). C'est le mécanisme qui empêche une intuition bien
 * formulée de battre un constat chiffré.
 */
export interface BrainProposal {
  id: string;
  brainId: BrainDomain;
  title: string;
  rationale: string;
  /** Métrique que cette proposition vise à améliorer. */
  targetMetricId: string;
  effort: Effort;
  risk: Risk;
  horizon: Horizon;
  /** Alignement déclaré avec la vision, sur [0,1]. */
  alignment: number;
  evidence: MetricReading[];
  /** Domaine d'agent qui exécuterait, si la proposition est retenue. */
  executionDomain: string;
}

export interface BrainReport {
  brainId: BrainDomain;
  label: string;
  /** Couverture de mesure du domaine, sur [0,1]. */
  coverage: number;
  readings: MetricReading[];
  proposals: BrainProposal[];
  /** Constat en clair, y compris « je ne vois rien » quand c'est le cas. */
  assessment: string;
}

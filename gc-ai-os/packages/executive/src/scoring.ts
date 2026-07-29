import type { AgentManifest, AgentSkill, Mission } from "@gc-ai-os/shared-types";
import { reliabilityOf } from "@gc-ai-os/telemetry";

/**
 * Pondérations de la fonction d'affectation. Exposées comme constantes
 * nommées plutôt que dispersées dans le calcul : ce sont des décisions
 * de politique d'entreprise, elles doivent pouvoir être discutées et
 * ajustées sans relire l'algorithme.
 *
 * Le domaine pèse le plus lourd (un agent hors domaine ne devrait pas
 * gagner sur sa seule rapidité), la fiabilité mesurée vient ensuite —
 * la vitesse et le coût ne servent qu'à départager à compétence égale.
 */
export const WEIGHTS = {
  domainFit: 0.4,
  reliability: 0.25,
  skillLevel: 0.15,
  speed: 0.1,
  costEfficiency: 0.1,
} as const;

export interface ScoredCandidate {
  agentId: string;
  score: number;
  breakdown: Record<keyof typeof WEIGHTS, number>;
}

export interface CandidateInput {
  manifest: AgentManifest;
  skill: AgentSkill;
}

/**
 * Normalise une métrique « plus petit = meilleur » (durée, coût) sur
 * [0,1] par rapport au pire candidat du lot. Sans historique (valeur 0),
 * on renvoie un neutre 0,5 plutôt que le score parfait — un agent jamais
 * mesuré ne doit pas gagner en se prétendant instantané et gratuit.
 */
function normalizeInverse(value: number, worst: number): number {
  if (value <= 0) return 0.5;
  if (worst <= 0) return 0.5;
  return 1 - value / worst;
}

/**
 * Fonction d'affectation du Directeur Général — délibérément
 * déterministe.
 *
 * Pourquoi pas un LLM ici : cette fonction s'exécute sur le chemin
 * critique de chaque mission. Un modèle y ajouterait de la latence, du
 * coût et surtout de l'imprévisibilité sur une décision qui doit être
 * reproductible et auditable (« pourquoi cet agent ? » doit avoir une
 * réponse chiffrée, pas « le modèle a estimé »). Le jugement qualitatif
 * du modèle est utilisé ailleurs — pour rédiger un plan ou critiquer un
 * livrable — là où sa valeur ajoutée est réelle.
 */
export function scoreCandidates(mission: Mission, candidates: CandidateInput[]): ScoredCandidate[] {
  const worstDuration = Math.max(0, ...candidates.map((c) => c.skill.avgDurationMs));
  const worstCost = Math.max(0, ...candidates.map((c) => c.skill.avgCostMicros));

  const scored = candidates.map(({ manifest, skill }) => {
    const breakdown = {
      domainFit: manifest.domain === mission.domain ? 1 : 0,
      reliability: reliabilityOf(skill),
      skillLevel: skill.level / 100,
      speed: normalizeInverse(skill.avgDurationMs, worstDuration),
      costEfficiency: normalizeInverse(skill.avgCostMicros, worstCost),
    };

    const score =
      breakdown.domainFit * WEIGHTS.domainFit +
      breakdown.reliability * WEIGHTS.reliability +
      breakdown.skillLevel * WEIGHTS.skillLevel +
      breakdown.speed * WEIGHTS.speed +
      breakdown.costEfficiency * WEIGHTS.costEfficiency;

    return { agentId: manifest.id, score: round(score), breakdown };
  });

  // Tri déterministe : à score égal, l'identifiant tranche, pour que deux
  // exécutions identiques produisent la même affectation.
  return scored.sort((a, b) => b.score - a.score || a.agentId.localeCompare(b.agentId));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

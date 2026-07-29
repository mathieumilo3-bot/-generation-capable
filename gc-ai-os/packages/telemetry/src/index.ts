import type { AgentSkill } from "@gc-ai-os/shared-types";

export interface SkillRepository {
  get(agentId: string, skill: string): Promise<AgentSkill | undefined>;
  listForSkill(skill: string): Promise<AgentSkill[]>;
  listForAgent(agentId: string): Promise<AgentSkill[]>;
  upsert(record: AgentSkill): Promise<void>;
}

export interface ExecutionOutcome {
  agentId: string;
  skill: string;
  success: boolean;
  durationMs: number;
  costMicros: number;
}

/**
 * Prior de Laplace pour la fiabilité. Un agent sans historique n'est ni
 * présumé excellent (ce qui le ferait choisir à tort) ni exclu (ce qui
 * l'empêcherait de jamais faire ses preuves) : il démarre à 0,5 et
 * converge vers son taux réel avec l'usage.
 */
const PRIOR_SUCCESSES = 1;
const PRIOR_RUNS = 2;

export function reliabilityOf(skill: Pick<AgentSkill, "runs" | "successes">): number {
  return (skill.successes + PRIOR_SUCCESSES) / (skill.runs + PRIOR_RUNS);
}

export function coldStartSkill(agentId: string, skill: string): AgentSkill {
  return {
    agentId,
    skill,
    level: 50,
    runs: 0,
    successes: 0,
    avgDurationMs: 0,
    avgCostMicros: 0,
    lastUsedAt: null,
  };
}

/**
 * Registre de compétences mesurées (voir docs/gc-ai-os/12-competences.md).
 *
 * Principe non négociable : un niveau de compétence n'est jamais saisi à
 * la main, il est toujours dérivé d'exécutions réelles. C'est ce qui
 * rend les décisions du Directeur Général défendables — elles reposent
 * sur ce que les agents ont effectivement produit, pas sur ce qu'ils
 * prétendent savoir faire.
 */
export class SkillRegistry {
  constructor(private readonly repository: SkillRepository) {}

  async get(agentId: string, skill: string): Promise<AgentSkill> {
    return (await this.repository.get(agentId, skill)) ?? coldStartSkill(agentId, skill);
  }

  async candidatesFor(skill: string): Promise<AgentSkill[]> {
    return this.repository.listForSkill(skill);
  }

  async profileOf(agentId: string): Promise<AgentSkill[]> {
    return this.repository.listForAgent(agentId);
  }

  /**
   * Enregistre le résultat d'une exécution et met à jour les moyennes
   * glissantes. Le niveau est recalculé à chaque fois : c'est une vue
   * dérivée, jamais une donnée d'entrée.
   */
  async record(outcome: ExecutionOutcome): Promise<AgentSkill> {
    const previous = await this.get(outcome.agentId, outcome.skill);

    const runs = previous.runs + 1;
    const successes = previous.successes + (outcome.success ? 1 : 0);

    const updated: AgentSkill = {
      agentId: outcome.agentId,
      skill: outcome.skill,
      runs,
      successes,
      avgDurationMs: rollingAverage(previous.avgDurationMs, previous.runs, outcome.durationMs),
      avgCostMicros: rollingAverage(previous.avgCostMicros, previous.runs, outcome.costMicros),
      level: Math.round(reliabilityOf({ runs, successes }) * 100),
      lastUsedAt: new Date().toISOString(),
    };

    await this.repository.upsert(updated);
    return updated;
  }
}

function rollingAverage(currentAvg: number, currentCount: number, sample: number): number {
  if (currentCount <= 0) return sample;
  return Math.round((currentAvg * currentCount + sample) / (currentCount + 1));
}

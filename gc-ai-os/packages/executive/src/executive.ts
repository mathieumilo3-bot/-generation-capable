import { randomUUID } from "node:crypto";
import type { AgentRegistry } from "@gc-ai-os/agents-core";
import type {
  ExecutiveDecision,
  ExecutiveDecisionKind,
  Mission,
  Objective,
} from "@gc-ai-os/shared-types";
import type { SkillRegistry } from "@gc-ai-os/telemetry";
import { scoreCandidates, type ScoredCandidate } from "./scoring";

export interface DecisionSink {
  record(decision: ExecutiveDecision): Promise<void>;
  listForObjective(objectiveId: string): Promise<ExecutiveDecision[]>;
}

export interface AssignmentResult {
  agentId: string;
  score: number;
  decision: ExecutiveDecision;
}

export class NoCapableAgentError extends Error {
  constructor(public readonly mission: Mission) {
    super(`Aucun agent capable pour la mission « ${mission.title} » (domaine ${mission.domain}).`);
    this.name = "NoCapableAgentError";
  }
}

export class BudgetExhaustedError extends Error {
  constructor(public readonly objective: Objective) {
    super(
      `Budget épuisé pour l'objectif « ${objective.title} » ` +
        `(${objective.spentMicros}/${objective.budgetMicros} micro-euros).`,
    );
    this.name = "BudgetExhaustedError";
  }
}

/**
 * Directeur Général IA (voir docs/gc-ai-os/13-directeur-general.md).
 *
 * Se situe au-dessus de l'Orchestrateur : là où l'Orchestrateur exécute
 * un tour de travail, le Directeur Général arbitre — qui travaille, à
 * quel coût, jusqu'où insister, quand s'arrêter et remonter à l'humain.
 *
 * Choix d'architecture assumé : c'est un moteur de politique
 * déterministe alimenté par la télémétrie réelle
 * (@gc-ai-os/telemetry), pas un agent conversationnel de plus. Chaque
 * arbitrage produit une trace reconstituable (score, alternatives
 * écartées, raison) — condition pour qu'une entreprise puisse déléguer
 * des décisions à ce système sans perdre la capacité de les expliquer.
 */
export class ExecutiveEngine {
  constructor(
    private readonly agents: AgentRegistry,
    private readonly skills: SkillRegistry,
    private readonly decisions: DecisionSink,
  ) {}

  /**
   * Garde-fou budgétaire. Vérifié avant chaque mission : un système
   * autonome travaillant plusieurs jours doit avoir une limite dure
   * qu'il ne peut pas contourner lui-même.
   */
  async assertBudget(objective: Objective): Promise<void> {
    if (objective.spentMicros < objective.budgetMicros) return;

    await this.log({
      objectiveId: objective.id,
      missionId: null,
      kind: "budget_halt",
      rationale:
        `Budget épuisé (${objective.spentMicros}/${objective.budgetMicros} micro-euros). ` +
        `Exécution interrompue et remontée à l'humain plutôt que poursuivie.`,
      chosenAgentId: null,
      alternatives: [],
      score: null,
    });

    throw new BudgetExhaustedError(objective);
  }

  /**
   * Sélectionne l'agent le mieux placé pour une mission. Les candidats
   * sont d'abord filtrés sur le domaine ; si aucun agent du domaine
   * n'existe, on élargit à l'ensemble du catalogue plutôt que d'échouer
   * — le score pénalise déjà lourdement le hors-domaine, donc le
   * système dégrade au lieu de bloquer.
   */
  async assign(mission: Mission): Promise<AssignmentResult> {
    const all = this.agents.list();
    const inDomain = all.filter((manifest) => manifest.domain === mission.domain);
    const pool = inDomain.length > 0 ? inDomain : all;

    if (pool.length === 0) {
      throw new NoCapableAgentError(mission);
    }

    const candidates = await Promise.all(
      pool.map(async (manifest) => ({
        manifest,
        skill: await this.skills.get(manifest.id, mission.requiredSkill),
      })),
    );

    const ranked = scoreCandidates(mission, candidates);
    const winner = ranked[0]!;

    const decision = await this.log({
      objectiveId: mission.objectiveId,
      missionId: mission.id,
      kind: "agent_selection",
      rationale: explain(winner, ranked, inDomain.length === 0),
      chosenAgentId: winner.agentId,
      alternatives: ranked.slice(1, 4).map((c) => ({ agentId: c.agentId, score: c.score })),
      score: winner.score,
    });

    return { agentId: winner.agentId, score: winner.score, decision };
  }

  /**
   * Décide si une mission échouée mérite une nouvelle tentative. La
   * politique est volontairement simple et lisible : on réessaie tant
   * qu'il reste des tentatives, puis on abandonne explicitement — jamais
   * de boucle infinie déguisée en persévérance.
   */
  async decideRetry(mission: Mission, failureReason: string): Promise<boolean> {
    const canRetry = mission.attempt < mission.maxAttempts;

    await this.log({
      objectiveId: mission.objectiveId,
      missionId: mission.id,
      kind: canRetry ? "retry" : "abandon",
      rationale: canRetry
        ? `Tentative ${mission.attempt}/${mission.maxAttempts} échouée (${failureReason}). ` +
          `Nouvelle tentative avec la critique injectée dans le brief.`
        : `Tentative ${mission.attempt}/${mission.maxAttempts} échouée (${failureReason}). ` +
          `Plafond atteint : mission abandonnée et remontée plutôt que réessayée indéfiniment.`,
      chosenAgentId: mission.assignedAgentId,
      alternatives: [],
      score: null,
    });

    return canRetry;
  }

  async escalate(mission: Mission, reason: string): Promise<ExecutiveDecision> {
    return this.log({
      objectiveId: mission.objectiveId,
      missionId: mission.id,
      kind: "escalation",
      rationale: reason,
      chosenAgentId: mission.assignedAgentId,
      alternatives: [],
      score: null,
    });
  }

  async history(objectiveId: string): Promise<ExecutiveDecision[]> {
    return this.decisions.listForObjective(objectiveId);
  }

  private async log(input: {
    objectiveId: string | null;
    missionId: string | null;
    kind: ExecutiveDecisionKind;
    rationale: string;
    chosenAgentId: string | null;
    alternatives: Array<{ agentId: string; score: number }>;
    score: number | null;
  }): Promise<ExecutiveDecision> {
    const decision: ExecutiveDecision = {
      id: randomUUID(),
      decidedAt: new Date().toISOString(),
      ...input,
    };
    await this.decisions.record(decision);
    return decision;
  }
}

function explain(
  winner: ScoredCandidate,
  ranked: ScoredCandidate[],
  widenedPool: boolean,
): string {
  const runnerUp = ranked[1];
  const margin = runnerUp ? ` devant ${runnerUp.agentId} (${runnerUp.score})` : " (seul candidat)";
  const b = winner.breakdown;
  const detail =
    `domaine=${b.domainFit}, fiabilité=${b.reliability.toFixed(2)}, ` +
    `niveau=${b.skillLevel.toFixed(2)}, vitesse=${b.speed.toFixed(2)}, ` +
    `coût=${b.costEfficiency.toFixed(2)}`;
  const widening = widenedPool
    ? " Aucun agent du domaine requis : sélection élargie à tout le catalogue."
    : "";
  return `${winner.agentId} retenu (score ${winner.score})${margin}. Détail : ${detail}.${widening}`;
}

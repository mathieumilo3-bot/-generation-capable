import { BudgetExhaustedError, type ExecutiveEngine } from "@gc-ai-os/executive";
import type { MemoryClient } from "@gc-ai-os/memory";
import type {
  Deliverable,
  Mission,
  Objective,
  ObjectiveHorizon,
  RiskLevel,
} from "@gc-ai-os/shared-types";
import type { SkillRegistry } from "@gc-ai-os/telemetry";
import { slug, type Planner } from "./planner";
import { buildBatches } from "./scheduler";
import type {
  DeliverableStore,
  KeyResultStore,
  MissionStore,
  ObjectiveStore,
} from "./stores";
import type { DeliverableValidator } from "./validation";

/** Coût forfaitaire imputé par tentative de mission, en micro-euros. */
const COST_PER_ATTEMPT_MICROS = 1000;

export interface PursueResult {
  objective: Objective;
  missions: Mission[];
  deliverables: Deliverable[];
  halted: boolean;
  haltReason: string | null;
}

/**
 * Contrat minimal attendu de l'Orchestrateur. Déclaré ici plutôt
 * qu'importé pour éviter une dépendance circulaire entre les deux
 * packages — le runtime câble l'implémentation réelle.
 */
export interface AgentRunner {
  runAgent(input: {
    agentId: string;
    prompt: string;
    riskLevel: RiskLevel;
    taskId: string | null;
  }): Promise<{ text: string; escalated: boolean }>;
}

/**
 * Moteur d'objectifs (voir docs/gc-ai-os/10-moteur-objectifs.md).
 *
 * Implémente le pipeline complet :
 *   Objectif → Planification → Missions → Affectation (Directeur
 *   Général) → Exécution parallèle → Auto-correction → Validation →
 *   Livraison.
 *
 * Différence avec l'Orchestrateur : l'Orchestrateur traite un tour de
 * conversation, le moteur d'objectifs poursuit un but sur la durée, avec
 * un budget, des résultats-clés mesurables et une condition d'arrêt.
 * C'est le passage d'un système « orienté conversation » à un système
 * « orienté objectifs ».
 *
 * Trois garde-fous rendent l'autonomie acceptable en entreprise :
 *   - budget dur (le Directeur Général interrompt à l'épuisement) ;
 *   - plafond de tentatives par mission (pas de boucle infinie) ;
 *   - RBAC + escalade sur action critique (aucune action sensible
 *     exécutée sans validation humaine).
 */
export class GoalEngine {
  constructor(
    private readonly deps: {
      objectives: ObjectiveStore;
      keyResults: KeyResultStore;
      missions: MissionStore;
      deliverables: DeliverableStore;
      planner: Planner;
      executive: ExecutiveEngine;
      /** L'Orchestrateur — seul chemin d'exécution vers un agent. */
      runner: AgentRunner;
      skills: SkillRegistry;
      validator: DeliverableValidator;
      memory?: MemoryClient;
    },
  ) {}

  /**
   * Crée un objectif et son plan sans l'exécuter. Séparer la
   * planification de l'exécution permet à un humain de relire le plan
   * avant d'engager du budget — et rend le plan lui-même livrable.
   */
  async defineObjective(input: {
    title: string;
    statement: string;
    horizon?: ObjectiveHorizon;
    budgetMicros?: number;
    deadline?: string | null;
  }): Promise<{ objective: Objective; missions: Mission[]; planSource: "model" | "template" }> {
    const horizon = input.horizon ?? "monthly";

    const objective = await this.deps.objectives.create({
      title: input.title,
      statement: input.statement,
      horizon,
      parentObjectiveId: null,
      budgetMicros: input.budgetMicros ?? 100_000,
      deadline: input.deadline ?? null,
    });

    await this.deps.objectives.updateStatus(objective.id, "planning");

    const plan = await this.deps.planner.plan({
      title: input.title,
      statement: input.statement,
      horizon,
    });

    for (const kr of plan.keyResults) {
      await this.deps.keyResults.create({
        objectiveId: objective.id,
        metric: kr.metric,
        unit: kr.unit,
        baseline: kr.baseline,
        target: kr.target,
        current: kr.baseline,
      });
    }

    // Les dépendances sont exprimées par `ref` dans le plan ; on les
    // traduit en identifiants réels une fois les missions persistées.
    const refToId = new Map<string, string>();
    const created: Mission[] = [];

    for (const planned of plan.missions) {
      const mission = await this.deps.missions.create({
        objectiveId: objective.id,
        title: planned.title,
        brief: planned.brief,
        domain: planned.domain,
        requiredSkill: planned.requiredSkill || slug(planned.title),
        status: "pending",
        dependsOn: [],
        attempt: 0,
        maxAttempts: 2,
        assignedAgentId: null,
        riskLevel: planned.riskLevel,
        acceptanceCriteria: planned.acceptanceCriteria,
      });
      refToId.set(planned.ref, mission.id);
      created.push(mission);
    }

    const withDependencies = await Promise.all(
      created.map(async (mission, index) => {
        const planned = plan.missions[index]!;
        const dependsOn = planned.dependsOn
          .map((ref) => refToId.get(ref))
          .filter((id): id is string => Boolean(id));
        return dependsOn.length > 0
          ? this.deps.missions.updateDependencies(mission.id, dependsOn)
          : mission;
      }),
    );

    await this.recordMemory(objective.id, "decision", `Plan de l'objectif « ${objective.title} »`,
      `Source du plan : ${plan.source}. ${withDependencies.length} missions générées.\n` +
        withDependencies.map((m) => `- ${m.title} (${m.domain})`).join("\n"));

    return { objective, missions: withDependencies, planSource: plan.source };
  }

  /**
   * Exécute toutes les missions d'un objectif, par vagues parallèles.
   * Idempotent sur les missions déjà terminées : relancer un objectif
   * partiellement exécuté reprend là où il s'était arrêté.
   */
  async pursue(objectiveId: string): Promise<PursueResult> {
    const objective = await this.requireObjective(objectiveId);
    await this.deps.objectives.updateStatus(objective.id, "executing");

    const all = await this.deps.missions.listForObjective(objective.id);
    const todo = all.filter((m) => m.status !== "completed");
    const batches = buildBatches(todo);

    let halted = false;
    let haltReason: string | null = null;

    for (const batch of batches) {
      if (halted) break;

      const results = await Promise.all(
        batch.missions.map((mission) => this.runMission(mission)),
      );

      for (const result of results) {
        if (result.kind === "halted") {
          halted = true;
          haltReason = result.reason;
        }
      }
    }

    const finalMissions = await this.deps.missions.listForObjective(objective.id);
    const deliverables = await this.deps.deliverables.listForObjective(objective.id);

    const allDone = finalMissions.every((m) => m.status === "completed");
    const anyAwaiting = finalMissions.some((m) => m.status === "awaiting_validation");

    const status = halted
      ? "halted"
      : allDone
        ? "achieved"
        : anyAwaiting
          ? "awaiting_validation"
          : "failed";

    const updated = await this.deps.objectives.updateStatus(objective.id, status);

    return {
      objective: updated,
      missions: finalMissions,
      deliverables,
      halted,
      haltReason,
    };
  }

  private async runMission(
    mission: Mission,
  ): Promise<{ kind: "done" | "failed" } | { kind: "halted"; reason: string }> {
    const objective = await this.requireObjective(mission.objectiveId);

    try {
      await this.deps.executive.assertBudget(objective);
    } catch (error) {
      if (error instanceof BudgetExhaustedError) {
        return { kind: "halted", reason: error.message };
      }
      throw error;
    }

    const assignment = await this.deps.executive.assign(mission);
    let current = await this.deps.missions.update(mission.id, {
      status: "in_progress",
      assignedAgentId: assignment.agentId,
    });

    let critique = "";

    while (current.attempt < current.maxAttempts) {
      current = await this.deps.missions.update(current.id, {
        attempt: current.attempt + 1,
        status: current.attempt === 0 ? "in_progress" : "self_correcting",
      });

      const started = Date.now();
      const outcome = await this.execute(current, assignment.agentId, critique);
      const durationMs = Date.now() - started;

      await this.deps.objectives.addSpend(objective.id, COST_PER_ATTEMPT_MICROS);

      if (outcome.kind === "escalated") {
        await this.deps.skills.record({
          agentId: assignment.agentId,
          skill: current.requiredSkill,
          success: false,
          durationMs,
          costMicros: COST_PER_ATTEMPT_MICROS,
        });
        await this.deps.executive.escalate(current, outcome.reason);
        await this.deps.missions.update(current.id, { status: "awaiting_validation" });
        await this.recordMemory(
          objective.id,
          "decision",
          `Mission escaladée : ${current.title}`,
          outcome.reason,
        );
        return { kind: "done" };
      }

      const verdict = await this.deps.validator.validate(current, outcome.content);

      await this.deps.skills.record({
        agentId: assignment.agentId,
        skill: current.requiredSkill,
        success: verdict.passed,
        durationMs,
        costMicros: COST_PER_ATTEMPT_MICROS,
      });

      if (verdict.passed) {
        await this.deps.deliverables.create({
          missionId: current.id,
          objectiveId: objective.id,
          filename: `${slug(current.title) || "livrable"}.md`,
          mediaType: "text/markdown",
          content: outcome.content,
          producedByAgentId: assignment.agentId,
        });
        await this.deps.missions.update(current.id, { status: "completed" });
        await this.recordMemory(
          objective.id,
          "learning",
          `Mission réussie : ${current.title}`,
          `Agent ${assignment.agentId} (score d'affectation ${assignment.score}), ` +
            `tentative ${current.attempt}/${current.maxAttempts}. ${verdict.critique}`.trim(),
        );
        return { kind: "done" };
      }

      critique = verdict.critique;
      await this.recordMemory(
        objective.id,
        "error",
        `Livrable rejeté : ${current.title}`,
        `Tentative ${current.attempt}/${current.maxAttempts} par ${assignment.agentId}. ` +
          `Critique : ${verdict.critique}`,
      );

      const retry = await this.deps.executive.decideRetry(current, verdict.critique);
      if (!retry) break;

      current = (await this.deps.missions.get(current.id)) ?? current;
    }

    await this.deps.missions.update(current.id, { status: "failed" });
    return { kind: "failed" };
  }

  /**
   * Fait produire le livrable par l'agent affecté, **via
   * l'Orchestrateur**. Celui-ci applique le RBAC et la journalisation :
   * une mission ne contourne jamais les permissions parce qu'elle vient
   * d'un objectif plutôt que d'un chat.
   */
  private async execute(
    mission: Mission,
    agentId: string,
    critique: string,
  ): Promise<{ kind: "produced"; content: string } | { kind: "escalated"; reason: string }> {
    const correction = critique
      ? `\n\nLa tentative précédente a été rejetée à la validation pour cette raison :\n` +
        `« ${critique} »\nCorrige précisément ce point dans cette nouvelle version.`
      : "";

    const reply = await this.deps.runner.runAgent({
      agentId,
      riskLevel: mission.riskLevel,
      taskId: null,
      prompt:
        `Mission : ${mission.title}\n\n` +
        `Brief :\n${mission.brief}\n\n` +
        `Critère de réussite : ${mission.acceptanceCriteria}\n\n` +
        `Produis directement le livrable en Markdown, structuré et actionnable. ` +
        `Pas de préambule, pas de méta-commentaire sur ta démarche.` +
        correction,
    });

    if (reply.escalated) {
      return { kind: "escalated", reason: reply.text };
    }
    return { kind: "produced", content: reply.text };
  }

  private async requireObjective(objectiveId: string): Promise<Objective> {
    const objective = await this.deps.objectives.get(objectiveId);
    if (!objective) throw new Error(`Objectif introuvable : ${objectiveId}`);
    return objective;
  }

  private async recordMemory(
    objectiveId: string,
    kind: "decision" | "error" | "learning",
    title: string,
    content: string,
  ): Promise<void> {
    if (!this.deps.memory) return;
    await this.deps.memory.write(
      { scope: "project", kind, objectiveId, title, content },
      "goal-engine",
    );
  }
}

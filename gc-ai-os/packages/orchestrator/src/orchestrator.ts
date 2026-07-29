import type { AgentRegistry } from "@gc-ai-os/agents-core";
import type { Task, TaskResult } from "@gc-ai-os/shared-types";
import { RoutingAmbiguityError } from "./errors.js";
import type { TaskStore } from "./task-store.js";

/**
 * Orchestrateur (voir docs/gc-ai-os/02-architecture-globale.md).
 * N'exécute jamais d'action outillée lui-même — il route vers un agent,
 * qui seul invoque des connecteurs via ConnectorGateway. Trois
 * responsabilités distinctes, exposées comme trois méthodes séparées
 * plutôt que fusionnées, pour rester fidèles à la séparation décrite
 * dans le document d'architecture.
 */
export class Orchestrator {
  constructor(
    private readonly agents: AgentRegistry,
    private readonly tasks: TaskStore,
  ) {}

  /**
   * Router — détermine quel agent est compétent pour un domaine donné.
   * Zéro ou plusieurs candidats est une ambiguïté : elle est remontée
   * (exception dédiée), jamais résolue par une supposition.
   */
  route(requiredDomain: string) {
    const candidates = this.agents.findByDomain(requiredDomain);
    if (candidates.length !== 1) {
      throw new RoutingAmbiguityError(
        requiredDomain,
        candidates.map((agent) => agent.manifest.id),
      );
    }
    return candidates[0]!;
  }

  /**
   * Planner — décompose une tâche en sous-tâches liées par
   * `parentTaskId`. Le squelette de phase 1 délègue la décomposition à
   * l'appelant (humain ou agent CEO/CTO) ; l'auto-décomposition par un
   * agent planificateur est un chantier de phase 2.
   */
  async plan(
    parent: Task,
    subtasks: Array<Omit<Task, "id" | "createdAt" | "updatedAt" | "closedAt" | "parentTaskId">>,
  ): Promise<Task[]> {
    return Promise.all(
      subtasks.map((subtask) =>
        this.tasks.create({ ...subtask, parentTaskId: parent.id }),
      ),
    );
  }

  /**
   * Superviseur — assigne la tâche à l'agent routé, exécute, persiste le
   * résultat. Les échecs remontent tels quels : la politique de retry /
   * escalade est un chantier de phase 2, volontairement absent de ce
   * squelette pour ne pas figer une stratégie non encore éprouvée.
   */
  async dispatch(task: Task, requiredDomain: string): Promise<TaskResult> {
    const agent = this.route(requiredDomain);
    await this.tasks.assign(task.id, agent.manifest.id);
    await this.tasks.updateStatus(task.id, "in_progress");

    const result = await agent.handleTask(task);

    await this.tasks.updateStatus(
      task.id,
      result.status === "completed" ? "completed" : "failed",
    );

    return result;
  }
}

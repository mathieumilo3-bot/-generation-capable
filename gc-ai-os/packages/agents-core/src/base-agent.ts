import type { Agent, AgentManifest, Task, TaskResult } from "@gc-ai-os/shared-types";

/**
 * Squelette commun à tous les agents. Les agents concrets
 * (packages/agents/<nom>-agent) étendent cette classe et implémentent
 * `execute`. `handleTask` reste responsable du contrat commun (statut par
 * défaut en cas d'exception) pour que ce comportement ne soit pas
 * réimplémenté — et potentiellement oublié — dans chaque agent.
 */
export abstract class BaseAgent implements Agent {
  abstract readonly manifest: AgentManifest;

  async handleTask(task: Task): Promise<TaskResult> {
    try {
      return await this.execute(task);
    } catch (error) {
      return {
        status: "failed",
        summary: error instanceof Error ? error.message : String(error),
      };
    }
  }

  protected abstract execute(task: Task): Promise<TaskResult>;
}

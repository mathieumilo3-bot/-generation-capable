import type { Task, TaskStatus } from "@gc-ai-os/shared-types";

/**
 * Persistance des tâches (voir docs/gc-ai-os/02-architecture-globale.md,
 * "Idempotence et reprise"). L'état d'une tâche vit toujours ici, jamais
 * uniquement dans la mémoire du process de l'Orchestrateur, pour
 * survivre à un redémarrage.
 */
export interface TaskStore {
  create(task: Omit<Task, "id" | "createdAt" | "updatedAt" | "closedAt">): Promise<Task>;
  updateStatus(taskId: string, status: TaskStatus): Promise<Task>;
  assign(taskId: string, agentId: string): Promise<Task>;
  get(taskId: string): Promise<Task | undefined>;
  listChildren(parentTaskId: string): Promise<Task[]>;
}

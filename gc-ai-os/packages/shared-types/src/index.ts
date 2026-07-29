/**
 * Types partagés de GC AI OS.
 *
 * Reflète les décisions d'architecture décrites dans
 * -generation-capable/docs/gc-ai-os/ (02, 03, 04, 05, 06). Toute
 * modification structurante d'un de ces types doit être répercutée dans
 * le document d'architecture correspondant.
 */

// ---------------------------------------------------------------------------
// Risque et permissions (voir 06-securite.md)
// ---------------------------------------------------------------------------

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RolePermission {
  roleId: string;
  capability: string;
  allowed: boolean;
  requiresHumanValidation: boolean;
}

export type AuditDecision = "allowed" | "denied" | "escalated";

export interface AuditLogEntry {
  id: string;
  actorAgentId: string;
  capability: string;
  paramsHash: string;
  riskLevel: RiskLevel;
  decision: AuditDecision;
  taskId: string | null;
  executedAt: string;
}

// ---------------------------------------------------------------------------
// Connecteurs (voir 05-connecteurs.md)
// ---------------------------------------------------------------------------

export interface ConnectorCapability {
  name: string;
  riskLevel: RiskLevel;
}

export interface ConnectorExecutionContext {
  agentId: string;
  taskId: string | null;
}

export interface ConnectorResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface Connector {
  id: string;
  capabilities: ConnectorCapability[];
  execute<T = unknown>(
    capability: string,
    params: Record<string, unknown>,
    context: ConnectorExecutionContext,
  ): Promise<ConnectorResult<T>>;
}

// ---------------------------------------------------------------------------
// Agents (voir 02-architecture-globale.md, 03-agents.md)
// ---------------------------------------------------------------------------

export interface AgentMemoryConfig {
  /** Portée de la mémoire privée de l'agent — toujours "agent". */
  scope: "agent";
  /** Autres couches de mémoire que l'agent peut lire, voir 04-memoire.md. */
  readAccess: MemoryScope[];
}

export interface AgentManifest {
  id: string;
  name: string;
  domain: string;
  role: string;
  responsibilities: string[];
  /** Capacités de connecteurs que l'agent est autorisé à invoquer. */
  tools: string[];
  memory: AgentMemoryConfig;
  /** Identifiant de modèle LLM utilisé, remplaçable indépendamment. */
  model: string;
}

export interface Agent {
  manifest: AgentManifest;
  /** Traite une tâche qui lui a été assignée par l'Orchestrateur. */
  handleTask(task: Task): Promise<TaskResult>;
}

export interface TaskResult {
  status: "completed" | "failed" | "escalated";
  summary: string;
  /** Entrées de mémoire proposées à l'issue de la tâche (apprentissage continu). */
  memoryUpdates?: MemoryEntryDraft[];
}

// ---------------------------------------------------------------------------
// Mémoire (voir 04-memoire.md)
// ---------------------------------------------------------------------------

export type MemoryScope =
  | "global"
  | "project"
  | "agent"
  | "technical"
  | "business";

export interface MemoryEntryDraft {
  scope: MemoryScope;
  projectId?: string;
  agentId?: string;
  title: string;
  content: string;
}

export interface MemoryEntry extends MemoryEntryDraft {
  id: string;
  createdBy: string;
  createdAt: string;
  version: number;
  supersededBy: string | null;
}

export interface Decision {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  scope: MemoryScope;
  relatedTaskId: string | null;
  decidedBy: string;
  decidedAt: string;
}

// ---------------------------------------------------------------------------
// Tâches (voir 02-architecture-globale.md)
// ---------------------------------------------------------------------------

export type TaskStatus =
  | "received"
  | "qualified"
  | "planned"
  | "in_progress"
  | "awaiting_validation"
  | "completed"
  | "failed";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedAgentId: string | null;
  parentTaskId: string | null;
  riskLevel: RiskLevel;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

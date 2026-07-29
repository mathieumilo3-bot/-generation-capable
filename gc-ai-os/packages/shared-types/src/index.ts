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

/**
 * Nature d'une entrée de mémoire. Une mémoire d'entreprise n'est pas un
 * historique de conversations : distinguer une décision d'une erreur ou
 * d'un apprentissage est ce qui rend la mémoire exploitable (on peut
 * demander « quelles erreurs avons-nous déjà faites sur ce sujet »
 * plutôt que de fouiller du texte libre).
 */
export type MemoryKind =
  | "note"
  | "decision"
  | "error"
  | "preference"
  | "learning"
  | "performance";

export interface MemoryEntryDraft {
  scope: MemoryScope;
  kind?: MemoryKind;
  projectId?: string;
  agentId?: string;
  objectiveId?: string;
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

// ---------------------------------------------------------------------------
// Objectifs et missions (voir 10-moteur-objectifs.md)
// ---------------------------------------------------------------------------

/**
 * Horizon d'un objectif. La hiérarchie annuel → trimestriel → mensuel →
 * hebdomadaire → quotidien permet à un objectif d'entreprise de se
 * décomposer récursivement (via `parentObjectiveId`) jusqu'à des
 * missions exécutables.
 */
export type ObjectiveHorizon =
  | "annual"
  | "quarterly"
  | "monthly"
  | "weekly"
  | "daily";

export type ObjectiveStatus =
  | "draft"
  | "planning"
  | "executing"
  | "awaiting_validation"
  | "achieved"
  | "halted"
  | "failed";

/**
 * Un résultat-clé mesurable. Sans métrique chiffrée, un système
 * autonome ne peut ni savoir s'il progresse ni savoir quand s'arrêter —
 * c'est la condition qui empêche un objectif de tourner indéfiniment.
 */
export interface KeyResult {
  id: string;
  objectiveId: string;
  metric: string;
  unit: string;
  baseline: number;
  target: number;
  current: number;
}

export interface Objective {
  id: string;
  title: string;
  statement: string;
  horizon: ObjectiveHorizon;
  parentObjectiveId: string | null;
  status: ObjectiveStatus;
  /** Budget d'exécution en micro-euros. Garde-fou dur : à zéro, le moteur s'arrête. */
  budgetMicros: number;
  spentMicros: number;
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
}

export type MissionStatus =
  | "pending"
  | "blocked"
  | "in_progress"
  | "self_correcting"
  | "awaiting_validation"
  | "completed"
  | "failed";

/**
 * Unité de travail exécutable par un agent, au service d'un objectif.
 * `dependsOn` porte le graphe de dépendances : les missions sans
 * dépendance non satisfaite s'exécutent en parallèle.
 */
export interface Mission {
  id: string;
  objectiveId: string;
  title: string;
  brief: string;
  /** Domaine d'agent requis (voir AgentManifest.domain). */
  domain: string;
  /** Compétence précise attendue, utilisée pour le scoring d'affectation. */
  requiredSkill: string;
  status: MissionStatus;
  dependsOn: string[];
  attempt: number;
  maxAttempts: number;
  assignedAgentId: string | null;
  riskLevel: RiskLevel;
  /** Critère observable de réussite — sert à la validation automatique. */
  acceptanceCriteria: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Artefact produit par une mission — le livrable téléchargeable. C'est
 * la sortie tangible du système : un objectif ne se termine pas par une
 * réponse de chat mais par des fichiers exploitables.
 */
export interface Deliverable {
  id: string;
  missionId: string;
  objectiveId: string;
  filename: string;
  mediaType: string;
  content: string;
  bytes: number;
  producedByAgentId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Compétences mesurées (télémétrie)
// ---------------------------------------------------------------------------

/**
 * Compétence d'un agent, mesurée par l'exécution réelle et non déclarée
 * à la main. C'est la donnée qui alimente les décisions du Directeur
 * Général (voir @gc-ai-os/executive).
 */
export interface AgentSkill {
  agentId: string;
  skill: string;
  /** 0–100, dérivé du taux de succès lissé. Jamais saisi manuellement. */
  level: number;
  runs: number;
  successes: number;
  avgDurationMs: number;
  avgCostMicros: number;
  lastUsedAt: string | null;
}

export type ExecutiveDecisionKind =
  | "agent_selection"
  | "budget_halt"
  | "escalation"
  | "retry"
  | "abandon";

/**
 * Trace d'arbitrage du Directeur Général. Chaque décision est
 * reconstituable : score retenu, alternatives écartées, raison.
 */
export interface ExecutiveDecision {
  id: string;
  objectiveId: string | null;
  missionId: string | null;
  kind: ExecutiveDecisionKind;
  rationale: string;
  chosenAgentId: string | null;
  alternatives: Array<{ agentId: string; score: number }>;
  score: number | null;
  decidedAt: string;
}

// ---------------------------------------------------------------------------
// GC AI Factory — agents déclaratifs (voir 11-factory.md)
// ---------------------------------------------------------------------------

/**
 * Spécification d'un agent produite par la Factory. Volontairement
 * déclarative : la Factory ne génère jamais de code exécutable, elle
 * remplit un schéma validable, versionnable et révocable. Un agent
 * publié est une ligne en base chargée au démarrage, pas un fichier
 * source non relu.
 */
export interface AgentBlueprint {
  id: string;
  name: string;
  domain: string;
  role: string;
  responsibilities: string[];
  skills: string[];
  tools: string[];
  /** Motifs (source RegExp) d'actions critiques refusées par cet agent. */
  criticalPatterns: string[];
  readAccess: MemoryScope[];
  model: string;
  systemGuidance: string;
}

export type PublishedAgentStatus = "candidate" | "published" | "revoked";

export interface PublishedAgent {
  blueprint: AgentBlueprint;
  status: PublishedAgentStatus;
  version: number;
  evaluationScore: number | null;
  createdBy: string;
  createdAt: string;
}

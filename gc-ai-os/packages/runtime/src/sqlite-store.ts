import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AuditSink, PermissionStore } from "@gc-ai-os/security";
import type { MemoryRepository } from "@gc-ai-os/memory";
import type { TaskStore } from "@gc-ai-os/orchestrator";
import type {
  AuditLogEntry,
  MemoryEntry,
  MemoryScope,
  RolePermission,
  Task,
  TaskStatus,
} from "@gc-ai-os/shared-types";
import { SCHEMA_SQL } from "./schema";

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: string;
  assigned_agent_id: string | null;
  parent_task_id: string | null;
  risk_level: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    assignedAgentId: row.assigned_agent_id,
    parentTaskId: row.parent_task_id,
    riskLevel: row.risk_level as Task["riskLevel"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

interface MemoryRow {
  id: string;
  scope: string;
  kind: string | null;
  objective_id: string | null;
  project_id: string | null;
  agent_id: string | null;
  title: string;
  content: string;
  embedding: string;
  created_by: string;
  created_at: string;
  version: number;
  superseded_by: string | null;
}

function rowToMemoryEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    scope: row.scope as MemoryScope,
    ...(row.kind !== null ? { kind: row.kind as NonNullable<MemoryEntry["kind"]> } : {}),
    ...(row.objective_id !== null ? { objectiveId: row.objective_id } : {}),
    ...(row.project_id !== null ? { projectId: row.project_id } : {}),
    ...(row.agent_id !== null ? { agentId: row.agent_id } : {}),
    title: row.title,
    content: row.content,
    createdBy: row.created_by,
    createdAt: row.created_at,
    version: row.version,
    supersededBy: row.superseded_by,
  };
}

/**
 * Implémentation SQLite locale des interfaces de persistance (voir
 * schema.ts). Un seul fichier, zéro service externe à faire tourner —
 * pensé pour qu'un poste de développement puisse démarrer GC AI OS sans
 * configuration. Migrer vers Supabase Postgres consiste à écrire une
 * autre classe implémentant les mêmes interfaces, pas à changer
 * l'Orchestrateur ou les agents.
 */
export class SqliteRuntimeStore implements TaskStore, PermissionStore, AuditSink, MemoryRepository {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("pragma journal_mode = WAL;");
    this.db.exec(SCHEMA_SQL);
  }

  /**
   * Connexion sous-jacente, exposée pour que la couche objectifs
   * (SqliteGoalStore) partage la même base et la même transactionnalité
   * plutôt que d'ouvrir un second handle sur le même fichier.
   */
  get connection(): DatabaseSync {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  // ---- TaskStore ----------------------------------------------------

  async create(task: Omit<Task, "id" | "createdAt" | "updatedAt" | "closedAt">): Promise<Task> {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db
      .prepare(
        `insert into tasks (id, title, description, status, assigned_agent_id, parent_task_id, risk_level, created_at, updated_at, closed_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, null)`,
      )
      .run(
        id,
        task.title,
        task.description,
        task.status,
        task.assignedAgentId,
        task.parentTaskId,
        task.riskLevel,
        now,
        now,
      );
    return (await this.get(id))!;
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const now = new Date().toISOString();
    const closed = status === "completed" || status === "failed" ? now : null;
    this.db
      .prepare(`update tasks set status = ?, updated_at = ?, closed_at = coalesce(?, closed_at) where id = ?`)
      .run(status, now, closed, taskId);
    return (await this.get(taskId))!;
  }

  async assign(taskId: string, agentId: string): Promise<Task> {
    const now = new Date().toISOString();
    this.db
      .prepare(`update tasks set assigned_agent_id = ?, updated_at = ? where id = ?`)
      .run(agentId, now, taskId);
    return (await this.get(taskId))!;
  }

  async get(taskId: string): Promise<Task | undefined> {
    const row = this.db.prepare(`select * from tasks where id = ?`).get(taskId) as
      | TaskRow
      | undefined;
    return row ? rowToTask(row) : undefined;
  }

  async listChildren(parentTaskId: string): Promise<Task[]> {
    const rows = this.db
      .prepare(`select * from tasks where parent_task_id = ? order by created_at asc`)
      .all(parentTaskId) as unknown as TaskRow[];
    return rows.map(rowToTask);
  }

  // ---- PermissionStore ------------------------------------------------

  async getPermission(roleId: string, capability: string): Promise<RolePermission | undefined> {
    const row = this.db
      .prepare(`select * from role_permissions where role_id = ? and capability = ?`)
      .get(roleId, capability) as
      | { role_id: string; capability: string; allowed: number; requires_human_validation: number }
      | undefined;
    if (!row) return undefined;
    return {
      roleId: row.role_id,
      capability: row.capability,
      allowed: Boolean(row.allowed),
      requiresHumanValidation: Boolean(row.requires_human_validation),
    };
  }

  grantPermission(permission: RolePermission): void {
    this.db
      .prepare(
        `insert into role_permissions (role_id, capability, allowed, requires_human_validation)
         values (?, ?, ?, ?)
         on conflict (role_id, capability) do update set allowed = excluded.allowed, requires_human_validation = excluded.requires_human_validation`,
      )
      .run(
        permission.roleId,
        permission.capability,
        permission.allowed ? 1 : 0,
        permission.requiresHumanValidation ? 1 : 0,
      );
  }

  // ---- AuditSink --------------------------------------------------------

  async record(entry: AuditLogEntry): Promise<void> {
    this.db
      .prepare(
        `insert into audit_log (id, actor_agent_id, capability, params_hash, risk_level, decision, task_id, executed_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.actorAgentId,
        entry.capability,
        entry.paramsHash,
        entry.riskLevel,
        entry.decision,
        entry.taskId,
        entry.executedAt,
      );
  }

  listAuditLog(limit = 50): AuditLogEntry[] {
    const rows = this.db
      .prepare(`select * from audit_log order by executed_at desc limit ?`)
      .all(limit) as Array<{
      id: string;
      actor_agent_id: string;
      capability: string;
      params_hash: string;
      risk_level: string;
      decision: string;
      task_id: string | null;
      executed_at: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      actorAgentId: row.actor_agent_id,
      capability: row.capability,
      paramsHash: row.params_hash,
      riskLevel: row.risk_level as AuditLogEntry["riskLevel"],
      decision: row.decision as AuditLogEntry["decision"],
      taskId: row.task_id,
      executedAt: row.executed_at,
    }));
  }

  // ---- MemoryRepository -------------------------------------------------

  async findLatest(
    scope: MemoryScope,
    title: string,
    projectId?: string,
    agentId?: string,
  ): Promise<MemoryEntry | undefined> {
    const row = this.db
      .prepare(
        `select * from memory_entries
         where scope = ? and title = ? and superseded_by is null
           and coalesce(project_id, '') = coalesce(?, '')
           and coalesce(agent_id, '') = coalesce(?, '')
         order by version desc limit 1`,
      )
      .get(scope, title, projectId ?? null, agentId ?? null) as MemoryRow | undefined;
    return row ? rowToMemoryEntry(row) : undefined;
  }

  async insert(entry: MemoryEntry, embedding: number[]): Promise<void> {
    this.db
      .prepare(
        `insert into memory_entries (id, scope, kind, objective_id, project_id, agent_id, title, content, embedding, created_by, created_at, version, superseded_by)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null)`,
      )
      .run(
        entry.id,
        entry.scope,
        entry.kind ?? "note",
        entry.objectiveId ?? null,
        entry.projectId ?? null,
        entry.agentId ?? null,
        entry.title,
        entry.content,
        JSON.stringify(embedding),
        entry.createdBy,
        entry.createdAt,
        entry.version,
      );
  }

  async markSuperseded(id: string, supersededBy: string): Promise<void> {
    this.db.prepare(`update memory_entries set superseded_by = ? where id = ?`).run(supersededBy, id);
  }

  async searchByEmbedding(
    embedding: number[],
    filters: { scope?: MemoryScope; projectId?: string },
    limit: number,
  ): Promise<MemoryEntry[]> {
    const rows = this.db
      .prepare(
        `select * from memory_entries
         where superseded_by is null
           and (? is null or scope = ?)
           and (? is null or project_id = ?)`,
      )
      .all(filters.scope ?? null, filters.scope ?? null, filters.projectId ?? null, filters.projectId ?? null) as unknown as MemoryRow[];

    const scored = rows.map((row) => ({
      entry: rowToMemoryEntry(row),
      score: cosineSimilarity(embedding, JSON.parse(row.embedding) as number[]),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.entry);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

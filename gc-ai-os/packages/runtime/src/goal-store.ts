import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { DecisionSink } from "@gc-ai-os/executive";
import type {
  DeliverableStore,
  KeyResultStore,
  MissionStore,
  ObjectiveStore,
} from "@gc-ai-os/goals";
import type { PublishedAgentStore } from "@gc-ai-os/factory";
import type { SkillRepository } from "@gc-ai-os/telemetry";
import type {
  AgentBlueprint,
  AgentSkill,
  Deliverable,
  ExecutiveDecision,
  KeyResult,
  Mission,
  Objective,
  ObjectiveStatus,
  PublishedAgent,
  PublishedAgentStatus,
} from "@gc-ai-os/shared-types";

type Row = Record<string, unknown>;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}
function nullableStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Implémentation SQLite des dépôts du moteur d'objectifs, de la
 * télémétrie, des arbitrages et de la Factory.
 *
 * Séparé de SqliteRuntimeStore pour que le fichier reste lisible : ce
 * sont deux familles de responsabilités distinctes (le socle
 * tâches/mémoire/sécurité d'un côté, la couche objectifs de l'autre),
 * même si elles partagent la même connexion.
 */
export class SqliteGoalStore {
  constructor(private readonly db: DatabaseSync) {}

  // ---- ObjectiveStore -------------------------------------------------

  async create(
    objective: Omit<Objective, "id" | "createdAt" | "updatedAt" | "spentMicros" | "status">,
  ): Promise<Objective> {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db
      .prepare(
        `insert into objectives (id, title, statement, horizon, parent_objective_id, status,
           budget_micros, spent_micros, created_at, updated_at, deadline)
         values (?, ?, ?, ?, ?, 'draft', ?, 0, ?, ?, ?)`,
      )
      .run(
        id,
        objective.title,
        objective.statement,
        objective.horizon,
        objective.parentObjectiveId,
        objective.budgetMicros,
        now,
        now,
        objective.deadline,
      );
    return (await this.get(id))!;
  }

  async get(objectiveId: string): Promise<Objective | undefined> {
    const row = this.db.prepare(`select * from objectives where id = ?`).get(objectiveId) as
      | Row
      | undefined;
    return row ? toObjective(row) : undefined;
  }

  async list(): Promise<Objective[]> {
    const rows = this.db
      .prepare(`select * from objectives order by created_at desc`)
      .all() as unknown as Row[];
    return rows.map(toObjective);
  }

  async updateStatus(objectiveId: string, status: ObjectiveStatus): Promise<Objective> {
    this.db
      .prepare(`update objectives set status = ?, updated_at = ? where id = ?`)
      .run(status, new Date().toISOString(), objectiveId);
    return (await this.get(objectiveId))!;
  }

  async addSpend(objectiveId: string, micros: number): Promise<Objective> {
    this.db
      .prepare(`update objectives set spent_micros = spent_micros + ?, updated_at = ? where id = ?`)
      .run(micros, new Date().toISOString(), objectiveId);
    return (await this.get(objectiveId))!;
  }

  // ---- KeyResultStore -------------------------------------------------

  async createKeyResult(keyResult: Omit<KeyResult, "id">): Promise<KeyResult> {
    const id = randomUUID();
    this.db
      .prepare(
        `insert into key_results (id, objective_id, metric, unit, baseline, target, current)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        keyResult.objectiveId,
        keyResult.metric,
        keyResult.unit,
        keyResult.baseline,
        keyResult.target,
        keyResult.current,
      );
    return { ...keyResult, id };
  }

  async listForObjective(objectiveId: string): Promise<KeyResult[]> {
    const rows = this.db
      .prepare(`select * from key_results where objective_id = ?`)
      .all(objectiveId) as unknown as Row[];
    return rows.map((row) => ({
      id: str(row.id),
      objectiveId: str(row.objective_id),
      metric: str(row.metric),
      unit: str(row.unit),
      baseline: num(row.baseline),
      target: num(row.target),
      current: num(row.current),
    }));
  }

  async updateCurrent(keyResultId: string, current: number): Promise<KeyResult> {
    this.db.prepare(`update key_results set current = ? where id = ?`).run(current, keyResultId);
    const row = this.db.prepare(`select * from key_results where id = ?`).get(keyResultId) as Row;
    return {
      id: str(row.id),
      objectiveId: str(row.objective_id),
      metric: str(row.metric),
      unit: str(row.unit),
      baseline: num(row.baseline),
      target: num(row.target),
      current: num(row.current),
    };
  }

  // ---- MissionStore ---------------------------------------------------

  async createMission(mission: Omit<Mission, "id" | "createdAt" | "updatedAt">): Promise<Mission> {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db
      .prepare(
        `insert into missions (id, objective_id, title, brief, domain, required_skill, status,
           depends_on, attempt, max_attempts, assigned_agent_id, risk_level, acceptance_criteria,
           created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        mission.objectiveId,
        mission.title,
        mission.brief,
        mission.domain,
        mission.requiredSkill,
        mission.status,
        JSON.stringify(mission.dependsOn),
        mission.attempt,
        mission.maxAttempts,
        mission.assignedAgentId,
        mission.riskLevel,
        mission.acceptanceCriteria,
        now,
        now,
      );
    return (await this.getMission(id))!;
  }

  async getMission(missionId: string): Promise<Mission | undefined> {
    const row = this.db.prepare(`select * from missions where id = ?`).get(missionId) as
      | Row
      | undefined;
    return row ? toMission(row) : undefined;
  }

  async listMissionsForObjective(objectiveId: string): Promise<Mission[]> {
    const rows = this.db
      .prepare(`select * from missions where objective_id = ? order by created_at asc`)
      .all(objectiveId) as unknown as Row[];
    return rows.map(toMission);
  }

  async updateMission(
    missionId: string,
    patch: Partial<Pick<Mission, "status" | "attempt" | "assignedAgentId" | "brief">>,
  ): Promise<Mission> {
    const current = await this.getMission(missionId);
    if (!current) throw new Error(`Mission introuvable : ${missionId}`);

    this.db
      .prepare(
        `update missions set status = ?, attempt = ?, assigned_agent_id = ?, brief = ?, updated_at = ?
         where id = ?`,
      )
      .run(
        patch.status ?? current.status,
        patch.attempt ?? current.attempt,
        patch.assignedAgentId ?? current.assignedAgentId,
        patch.brief ?? current.brief,
        new Date().toISOString(),
        missionId,
      );
    return (await this.getMission(missionId))!;
  }

  async updateDependencies(missionId: string, dependsOn: string[]): Promise<Mission> {
    this.db
      .prepare(`update missions set depends_on = ?, updated_at = ? where id = ?`)
      .run(JSON.stringify(dependsOn), new Date().toISOString(), missionId);
    return (await this.getMission(missionId))!;
  }

  // ---- DeliverableStore -----------------------------------------------

  async createDeliverable(
    deliverable: Omit<Deliverable, "id" | "createdAt" | "bytes">,
  ): Promise<Deliverable> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const bytes = Buffer.byteLength(deliverable.content, "utf8");

    this.db
      .prepare(
        `insert into deliverables (id, mission_id, objective_id, filename, media_type, content,
           bytes, produced_by_agent_id, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        deliverable.missionId,
        deliverable.objectiveId,
        deliverable.filename,
        deliverable.mediaType,
        deliverable.content,
        bytes,
        deliverable.producedByAgentId,
        createdAt,
      );

    return { ...deliverable, id, bytes, createdAt };
  }

  async getDeliverable(deliverableId: string): Promise<Deliverable | undefined> {
    const row = this.db.prepare(`select * from deliverables where id = ?`).get(deliverableId) as
      | Row
      | undefined;
    return row ? toDeliverable(row) : undefined;
  }

  async listDeliverablesForObjective(objectiveId: string): Promise<Deliverable[]> {
    const rows = this.db
      .prepare(`select * from deliverables where objective_id = ? order by created_at asc`)
      .all(objectiveId) as unknown as Row[];
    return rows.map(toDeliverable);
  }

  // ---- SkillRepository ------------------------------------------------

  async getSkill(agentId: string, skill: string): Promise<AgentSkill | undefined> {
    const row = this.db
      .prepare(`select * from agent_skills where agent_id = ? and skill = ?`)
      .get(agentId, skill) as Row | undefined;
    return row ? toSkill(row) : undefined;
  }

  async listForSkill(skill: string): Promise<AgentSkill[]> {
    const rows = this.db
      .prepare(`select * from agent_skills where skill = ?`)
      .all(skill) as unknown as Row[];
    return rows.map(toSkill);
  }

  async listForAgent(agentId: string): Promise<AgentSkill[]> {
    const rows = this.db
      .prepare(`select * from agent_skills where agent_id = ? order by level desc`)
      .all(agentId) as unknown as Row[];
    return rows.map(toSkill);
  }

  async upsert(record: AgentSkill): Promise<void> {
    this.db
      .prepare(
        `insert into agent_skills (agent_id, skill, level, runs, successes, avg_duration_ms,
           avg_cost_micros, last_used_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (agent_id, skill) do update set
           level = excluded.level, runs = excluded.runs, successes = excluded.successes,
           avg_duration_ms = excluded.avg_duration_ms, avg_cost_micros = excluded.avg_cost_micros,
           last_used_at = excluded.last_used_at`,
      )
      .run(
        record.agentId,
        record.skill,
        record.level,
        record.runs,
        record.successes,
        record.avgDurationMs,
        record.avgCostMicros,
        record.lastUsedAt,
      );
  }

  // ---- DecisionSink ---------------------------------------------------

  async record(decision: ExecutiveDecision): Promise<void> {
    this.db
      .prepare(
        `insert into executive_decisions (id, objective_id, mission_id, kind, rationale,
           chosen_agent_id, alternatives, score, decided_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        decision.id,
        decision.objectiveId,
        decision.missionId,
        decision.kind,
        decision.rationale,
        decision.chosenAgentId,
        JSON.stringify(decision.alternatives),
        decision.score,
        decision.decidedAt,
      );
  }

  async listDecisionsForObjective(objectiveId: string): Promise<ExecutiveDecision[]> {
    const rows = this.db
      .prepare(`select * from executive_decisions where objective_id = ? order by decided_at asc`)
      .all(objectiveId) as unknown as Row[];
    return rows.map((row) => ({
      id: str(row.id),
      objectiveId: nullableStr(row.objective_id),
      missionId: nullableStr(row.mission_id),
      kind: str(row.kind) as ExecutiveDecision["kind"],
      rationale: str(row.rationale),
      chosenAgentId: nullableStr(row.chosen_agent_id),
      alternatives: parseJson<ExecutiveDecision["alternatives"]>(row.alternatives, []),
      score: typeof row.score === "number" ? row.score : null,
      decidedAt: str(row.decided_at),
    }));
  }

  // ---- PublishedAgentStore --------------------------------------------

  async save(agent: PublishedAgent): Promise<void> {
    this.db
      .prepare(
        `insert into published_agents (agent_id, blueprint, status, version, evaluation_score,
           created_by, created_at)
         values (?, ?, ?, ?, ?, ?, ?)
         on conflict (agent_id) do update set
           blueprint = excluded.blueprint, status = excluded.status, version = excluded.version,
           evaluation_score = excluded.evaluation_score, created_at = excluded.created_at`,
      )
      .run(
        agent.blueprint.id,
        JSON.stringify(agent.blueprint),
        agent.status,
        agent.version,
        agent.evaluationScore,
        agent.createdBy,
        agent.createdAt,
      );
  }

  async getPublished(agentId: string): Promise<PublishedAgent | undefined> {
    const row = this.db
      .prepare(`select * from published_agents where agent_id = ?`)
      .get(agentId) as Row | undefined;
    return row ? toPublishedAgent(row) : undefined;
  }

  /**
   * Variante synchrone utilisée au démarrage : le bootstrap assemble le
   * runtime de façon synchrone, et SQLite l'est nativement — inutile de
   * rendre tout le chemin d'amorçage asynchrone pour une seule lecture.
   */
  /**
   * Compteurs opérationnels que le système observe sur lui-même. Sert à
   * alimenter les métriques `derived` du COO Brain — la seule famille de
   * métriques qui ne dépend d'aucun connecteur externe.
   */
  operationalStats(): {
    missionsCompleted: number;
    missionsFailed: number;
    missionsAwaitingValidation: number;
    skillRuns: number;
    skillSuccesses: number;
  } {
    const count = (sql: string): number => {
      const row = this.db.prepare(sql).get() as Row | undefined;
      return typeof row?.n === "number" ? row.n : 0;
    };

    return {
      missionsCompleted: count(`select count(*) as n from missions where status = 'completed'`),
      missionsFailed: count(`select count(*) as n from missions where status = 'failed'`),
      missionsAwaitingValidation: count(
        `select count(*) as n from missions where status = 'awaiting_validation'`,
      ),
      skillRuns: count(`select coalesce(sum(runs), 0) as n from agent_skills`),
      skillSuccesses: count(`select coalesce(sum(successes), 0) as n from agent_skills`),
    };
  }

  listPublishedSync(): PublishedAgent[] {
    const rows = this.db
      .prepare(`select * from published_agents where status = 'published'`)
      .all() as unknown as Row[];
    return rows.map(toPublishedAgent);
  }

  async listPublished(): Promise<PublishedAgent[]> {
    const rows = this.db
      .prepare(`select * from published_agents where status = 'published'`)
      .all() as unknown as Row[];
    return rows.map(toPublishedAgent);
  }

  async listAll(): Promise<PublishedAgent[]> {
    const rows = this.db
      .prepare(`select * from published_agents order by created_at desc`)
      .all() as unknown as Row[];
    return rows.map(toPublishedAgent);
  }

  async revoke(agentId: string): Promise<void> {
    this.db.prepare(`update published_agents set status = 'revoked' where agent_id = ?`).run(agentId);
  }
}

/**
 * Adaptateurs vers les interfaces attendues par chaque package.
 *
 * `SqliteGoalStore` porte une seule connexion et des noms de méthodes
 * distincts (`createMission`, `getMission`…) parce que plusieurs
 * interfaces déclarent des méthodes homonymes (`create`, `get`,
 * `listForObjective`). Ces adaptateurs exposent la forme exacte attendue
 * sans dupliquer la logique SQL ni ouvrir une seconde connexion.
 */
export function objectiveStoreOf(store: SqliteGoalStore): ObjectiveStore {
  return {
    create: (objective) => store.create(objective),
    get: (id) => store.get(id),
    list: () => store.list(),
    updateStatus: (id, status) => store.updateStatus(id, status),
    addSpend: (id, micros) => store.addSpend(id, micros),
  };
}

export function keyResultStoreOf(store: SqliteGoalStore): KeyResultStore {
  return {
    create: (keyResult) => store.createKeyResult(keyResult),
    listForObjective: (id) => store.listForObjective(id),
    updateCurrent: (id, current) => store.updateCurrent(id, current),
  };
}

export function missionStoreOf(store: SqliteGoalStore): MissionStore {
  return {
    create: (mission) => store.createMission(mission),
    get: (id) => store.getMission(id),
    listForObjective: (id) => store.listMissionsForObjective(id),
    update: (id, patch) => store.updateMission(id, patch),
    updateDependencies: (id, dependsOn) => store.updateDependencies(id, dependsOn),
  };
}

export function deliverableStoreOf(store: SqliteGoalStore): DeliverableStore {
  return {
    create: (deliverable) => store.createDeliverable(deliverable),
    get: (id) => store.getDeliverable(id),
    listForObjective: (id) => store.listDeliverablesForObjective(id),
  };
}

export function skillRepositoryOf(store: SqliteGoalStore): SkillRepository {
  return {
    get: (agentId, skill) => store.getSkill(agentId, skill),
    listForSkill: (skill) => store.listForSkill(skill),
    listForAgent: (agentId) => store.listForAgent(agentId),
    upsert: (record) => store.upsert(record),
  };
}

export function decisionSinkOf(store: SqliteGoalStore): DecisionSink {
  return {
    record: (decision) => store.record(decision),
    listForObjective: (id) => store.listDecisionsForObjective(id),
  };
}

export function publishedAgentStoreOf(store: SqliteGoalStore): PublishedAgentStore {
  return {
    save: (agent) => store.save(agent),
    get: (id) => store.getPublished(id),
    listPublished: () => store.listPublished(),
    listAll: () => store.listAll(),
    revoke: (id) => store.revoke(id),
  };
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toObjective(row: Row): Objective {
  return {
    id: str(row.id),
    title: str(row.title),
    statement: str(row.statement),
    horizon: str(row.horizon, "monthly") as Objective["horizon"],
    parentObjectiveId: nullableStr(row.parent_objective_id),
    status: str(row.status, "draft") as ObjectiveStatus,
    budgetMicros: num(row.budget_micros),
    spentMicros: num(row.spent_micros),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    deadline: nullableStr(row.deadline),
  };
}

function toMission(row: Row): Mission {
  return {
    id: str(row.id),
    objectiveId: str(row.objective_id),
    title: str(row.title),
    brief: str(row.brief),
    domain: str(row.domain),
    requiredSkill: str(row.required_skill),
    status: str(row.status, "pending") as Mission["status"],
    dependsOn: parseJson<string[]>(row.depends_on, []),
    attempt: num(row.attempt),
    maxAttempts: num(row.max_attempts, 2),
    assignedAgentId: nullableStr(row.assigned_agent_id),
    riskLevel: str(row.risk_level, "low") as Mission["riskLevel"],
    acceptanceCriteria: str(row.acceptance_criteria),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

function toDeliverable(row: Row): Deliverable {
  return {
    id: str(row.id),
    missionId: str(row.mission_id),
    objectiveId: str(row.objective_id),
    filename: str(row.filename),
    mediaType: str(row.media_type, "text/markdown"),
    content: str(row.content),
    bytes: num(row.bytes),
    producedByAgentId: str(row.produced_by_agent_id),
    createdAt: str(row.created_at),
  };
}

function toSkill(row: Row): AgentSkill {
  return {
    agentId: str(row.agent_id),
    skill: str(row.skill),
    level: num(row.level, 50),
    runs: num(row.runs),
    successes: num(row.successes),
    avgDurationMs: num(row.avg_duration_ms),
    avgCostMicros: num(row.avg_cost_micros),
    lastUsedAt: nullableStr(row.last_used_at),
  };
}

function toPublishedAgent(row: Row): PublishedAgent {
  return {
    blueprint: parseJson<AgentBlueprint>(row.blueprint, {
      id: str(row.agent_id),
      name: str(row.agent_id),
      domain: str(row.agent_id),
      role: "",
      responsibilities: [],
      skills: [],
      tools: [],
      criticalPatterns: [],
      readAccess: ["business"],
      model: "claude-sonnet-5",
      systemGuidance: "",
    }),
    status: str(row.status, "candidate") as PublishedAgentStatus,
    version: num(row.version, 1),
    evaluationScore: typeof row.evaluation_score === "number" ? row.evaluation_score : null,
    createdBy: str(row.created_by),
    createdAt: str(row.created_at),
  };
}

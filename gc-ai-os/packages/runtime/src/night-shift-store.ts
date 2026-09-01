import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type NightShiftStatus = "queued" | "running" | "completed" | "failed" | "blocked" | "stopped";

export interface NightShiftRun {
  id: string;
  title: string;
  prompt: string;
  projects: string[];
  deadline: string;
  objectiveId: string | null;
  status: NightShiftStatus;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = Record<string, unknown>;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseProjects(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toRun(row: Row): NightShiftRun {
  return {
    id: str(row.id),
    title: str(row.title),
    prompt: str(row.prompt),
    projects: parseProjects(row.projects),
    deadline: str(row.deadline),
    objectiveId: nullableStr(row.objective_id),
    status: str(row.status) as NightShiftStatus,
    startedAt: nullableStr(row.started_at),
    finishedAt: nullableStr(row.finished_at),
    lastError: nullableStr(row.last_error),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

/** Durable control-plane state for the overnight autonomous worker. */
export class SqliteNightShiftStore {
  constructor(private readonly db: DatabaseSync) {}

  create(input: { title: string; prompt: string; projects: string[]; deadline: string }): NightShiftRun {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db
      .prepare(
        `insert into night_shift_runs
          (id, title, prompt, projects, deadline, objective_id, status, started_at, finished_at, last_error, created_at, updated_at)
         values (?, ?, ?, ?, ?, null, 'queued', null, null, null, ?, ?)`,
      )
      .run(id, input.title, input.prompt, JSON.stringify(input.projects), input.deadline, now, now);
    return this.get(id)!;
  }

  get(id: string): NightShiftRun | undefined {
    const row = this.db.prepare(`select * from night_shift_runs where id = ?`).get(id) as Row | undefined;
    return row ? toRun(row) : undefined;
  }

  latest(): NightShiftRun | undefined {
    const row = this.db.prepare(`select * from night_shift_runs order by created_at desc limit 1`).get() as Row | undefined;
    return row ? toRun(row) : undefined;
  }

  resumable(): NightShiftRun | undefined {
    const row = this.db
      .prepare(`select * from night_shift_runs where status in ('queued', 'running') order by created_at asc limit 1`)
      .get() as Row | undefined;
    return row ? toRun(row) : undefined;
  }

  markRunning(id: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`update night_shift_runs set status = 'running', started_at = coalesce(started_at, ?), updated_at = ?, last_error = null where id = ?`)
      .run(now, now, id);
  }

  attachObjective(id: string, objectiveId: string): void {
    this.db.prepare(`update night_shift_runs set objective_id = ?, updated_at = ? where id = ?`).run(objectiveId, new Date().toISOString(), id);
  }

  finish(id: string, status: Exclude<NightShiftStatus, "queued" | "running">, error: string | null = null): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`update night_shift_runs set status = ?, finished_at = ?, last_error = ?, updated_at = ? where id = ?`)
      .run(status, now, error, now, id);
  }
}

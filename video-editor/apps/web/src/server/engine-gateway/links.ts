import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { resolveStorageRoot } from "../storage";

/**
 * Table de liaison externalJobId (video_jobs.id côté produit) ⇄ projet moteur. Fichier SQLite SÉPARÉ de la
 * base du moteur : le moteur reste intact, la passerelle est une couche d'adaptation autonome.
 */
export type LinkState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface Link {
  externalJobId: string;
  engineJobId: string;
  kind: "create" | "revision";
  projectId: string;
  attempt: number;
  renderQueueJobId: string | null;
  revisionBaselineRenderIds: string[];
  /** Pour une révision : rendu produit (renseigné à la fin). */
  renderId: string | null;
  state: LinkState;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  createdAt: string;
}

declare global { var __engineLinks: DatabaseSync | undefined }

function handle(): DatabaseSync {
  if (!globalThis.__engineLinks) {
    const db = new DatabaseSync(join(resolveStorageRoot(), "engine-gateway.sqlite"));
    db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    db.exec(`CREATE TABLE IF NOT EXISTS links (
      external_job_id TEXT PRIMARY KEY, engine_job_id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, project_id TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 1, render_queue_job_id TEXT, baseline TEXT NOT NULL DEFAULT '[]', render_id TEXT,
      state TEXT NOT NULL, error_code TEXT, error_message TEXT, retryable INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`);
    globalThis.__engineLinks = db;
  }
  return globalThis.__engineLinks;
}

const row = (r: Record<string, unknown> | undefined): Link | null => r ? ({
  externalJobId: String(r.external_job_id), engineJobId: String(r.engine_job_id), kind: r.kind as Link["kind"], projectId: String(r.project_id),
  attempt: Number(r.attempt), renderQueueJobId: (r.render_queue_job_id as string | null) ?? null,
  revisionBaselineRenderIds: JSON.parse(String(r.baseline)) as string[], renderId: (r.render_id as string | null) ?? null,
  state: r.state as LinkState, errorCode: (r.error_code as string | null) ?? null, errorMessage: (r.error_message as string | null) ?? null,
  retryable: Number(r.retryable) === 1, createdAt: String(r.created_at),
}) : null;

export const links = {
  byExternal: (id: string) => row(handle().prepare("SELECT * FROM links WHERE external_job_id=?").get(id) as Record<string, unknown> | undefined),
  byEngine: (id: string) => row(handle().prepare("SELECT * FROM links WHERE engine_job_id=?").get(id) as Record<string, unknown> | undefined),
  upsert(l: Omit<Link, "createdAt">): void {
    handle().prepare(`INSERT INTO links (external_job_id, engine_job_id, kind, project_id, attempt, render_queue_job_id, baseline, render_id, state, error_code, error_message, retryable, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(external_job_id) DO UPDATE SET engine_job_id=excluded.engine_job_id, kind=excluded.kind, project_id=excluded.project_id, attempt=excluded.attempt,
        render_queue_job_id=excluded.render_queue_job_id, baseline=excluded.baseline, render_id=excluded.render_id, state=excluded.state,
        error_code=excluded.error_code, error_message=excluded.error_message, retryable=excluded.retryable`)
      .run(l.externalJobId, l.engineJobId, l.kind, l.projectId, l.attempt, l.renderQueueJobId, JSON.stringify(l.revisionBaselineRenderIds), l.renderId,
        l.state, l.errorCode, l.errorMessage, l.retryable ? 1 : 0, new Date().toISOString());
  },
  update(externalJobId: string, patch: Partial<Pick<Link, "state" | "errorCode" | "errorMessage" | "retryable" | "renderId">>): void {
    const cur = links.byExternal(externalJobId);
    if (cur) links.upsert({ ...cur, ...patch });
  },
};

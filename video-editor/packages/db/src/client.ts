import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { newId } from "@video-editor/shared-types";
import type {
  Project,
  ProjectStatus,
  Rush,
  ReferenceVideo,
  Segment,
  StyleProfile,
  Brief,
  BriefSpec,
  StoryBlueprint,
  EditBlueprint,
  RenderVersion,
  RenderStatus,
  QcReport,
  PipelineStage,
  JobStatus,
  FeedbackEvent,
  FeedbackEventType,
  ConversationalCommand,
  CostLedgerEntry,
  RenderJob,
  RenderJobStatus,
  RenderJobPriority,
  RenderProfile,
  RenderMetrics,
} from "@video-editor/shared-types";
import { RUNNING_JOB_STATUSES, TERMINAL_JOB_STATUSES } from "@video-editor/shared-types";

const __dirname = dirname(fileURLToPath(import.meta.url));

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Wrapper unique autour de node:sqlite. Un seul fichier, pas d'ORM : à ce
 * stade du MVP un query builder ajouterait une couche d'indirection sans
 * bénéfice réel (§22 du brief : architecture simple tant qu'elle ne crée
 * pas de dette critique). Migrer vers l'implémentation Postgres consiste
 * à réécrire cette classe derrière la même interface publique, pas à
 * changer les appelants (agents, pipeline, apps/web) — même stratégie que
 * gc-ai-os (TaskStore/MemoryRepository).
 */
export class Db {
  private sqlite: DatabaseSync;

  constructor(path: string) {
    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec("PRAGMA foreign_keys = ON;");
    // WAL + busy_timeout : indispensables maintenant que plusieurs process
    // (serveur web + scheduler + N workers de rendu, voir
    // @video-editor/orchestrator) écrivent dans le MÊME fichier SQLite. WAL
    // autorise lectures concurrentes pendant une écriture ; busy_timeout
    // fait patienter un writer plutôt que d'échouer sur "database is
    // locked". Sans effet néfaste en mono-process (le mode démo/CLI).
    try {
      this.sqlite.exec("PRAGMA journal_mode = WAL;");
      this.sqlite.exec("PRAGMA busy_timeout = 10000;");
      this.sqlite.exec("PRAGMA synchronous = NORMAL;");
    } catch {
      // Certains FS (montages réseau) refusent WAL — on reste en mode par
      // défaut, le busy_timeout suffira à sérialiser les écritures.
    }
    const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
    this.sqlite.exec(schema);
  }

  close(): void {
    this.sqlite.close();
  }

  // ---- projects ----------------------------------------------------
  createProject(input: { userId: string; title: string }): Project {
    const project: Project = {
      id: newId("proj"),
      userId: input.userId,
      title: input.title,
      status: "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.sqlite
      .prepare(
        `INSERT INTO projects (id, user_id, title, status, created_at, updated_at)
         VALUES ($id, $userId, $title, $status, $createdAt, $updatedAt)`
      )
      .run({
        $id: project.id,
        $userId: project.userId,
        $title: project.title,
        $status: project.status,
        $createdAt: project.createdAt,
        $updatedAt: project.updatedAt,
      });
    return project;
  }

  getProject(id: string): Project | null {
    const row = this.sqlite.prepare(`SELECT * FROM projects WHERE id = $id`).get({ $id: id }) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return rowToProject(row);
  }

  setProjectStatus(id: string, status: ProjectStatus): void {
    this.sqlite
      .prepare(`UPDATE projects SET status = $status, updated_at = $updatedAt WHERE id = $id`)
      .run({ $status: status, $updatedAt: nowIso(), $id: id });
  }

  // ---- rushes --------------------------------------------------------
  createRush(input: {
    projectId: string;
    originalFilename: string;
    storagePath: string;
    container: Rush["container"];
    codec: Rush["codec"];
    durationSec: number;
    hasAudio: boolean;
  }): Rush {
    const rush: Rush = {
      id: newId("rush"),
      projectId: input.projectId,
      originalFilename: input.originalFilename,
      storagePath: input.storagePath,
      container: input.container,
      codec: input.codec,
      durationSec: input.durationSec,
      hasAudio: input.hasAudio,
      proxyReady: false,
      createdAt: nowIso(),
    };
    this.sqlite
      .prepare(
        `INSERT INTO rushes (id, project_id, original_filename, storage_path, container, codec, duration_sec, has_audio, proxy_path, proxy_ready, created_at)
         VALUES ($id, $projectId, $originalFilename, $storagePath, $container, $codec, $durationSec, $hasAudio, NULL, 0, $createdAt)`
      )
      .run({
        $id: rush.id,
        $projectId: rush.projectId,
        $originalFilename: rush.originalFilename,
        $storagePath: rush.storagePath,
        $container: rush.container,
        $codec: rush.codec,
        $durationSec: rush.durationSec,
        $hasAudio: rush.hasAudio ? 1 : 0,
        $createdAt: rush.createdAt,
      });
    return rush;
  }

  setRushProxy(id: string, proxyPath: string): void {
    this.sqlite
      .prepare(`UPDATE rushes SET proxy_path = $proxyPath, proxy_ready = 1 WHERE id = $id`)
      .run({ $proxyPath: proxyPath, $id: id });
  }

  listRushesByProject(projectId: string): Rush[] {
    const rows = this.sqlite
      .prepare(`SELECT * FROM rushes WHERE project_id = $projectId ORDER BY created_at ASC`)
      .all({ $projectId: projectId }) as Record<string, unknown>[];
    return rows.map(rowToRush);
  }

  getRush(id: string): Rush | null {
    const row = this.sqlite.prepare(`SELECT * FROM rushes WHERE id = $id`).get({ $id: id }) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToRush(row) : null;
  }

  // ---- reference videos ----------------------------------------------
  createReferenceVideo(input: { projectId: string; storagePath: string; durationSec: number }): ReferenceVideo {
    const ref: ReferenceVideo = {
      id: newId("refv"),
      projectId: input.projectId,
      storagePath: input.storagePath,
      durationSec: input.durationSec,
      createdAt: nowIso(),
    };
    this.sqlite
      .prepare(
        `INSERT INTO reference_videos (id, project_id, storage_path, duration_sec, created_at)
         VALUES ($id, $projectId, $storagePath, $durationSec, $createdAt)`
      )
      .run({
        $id: ref.id,
        $projectId: ref.projectId,
        $storagePath: ref.storagePath,
        $durationSec: ref.durationSec,
        $createdAt: ref.createdAt,
      });
    return ref;
  }

  listReferenceVideosByProject(projectId: string): ReferenceVideo[] {
    const rows = this.sqlite
      .prepare(`SELECT * FROM reference_videos WHERE project_id = $projectId`)
      .all({ $projectId: projectId }) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      storagePath: r.storage_path as string,
      durationSec: r.duration_sec as number,
      createdAt: r.created_at as string,
    }));
  }

  // ---- segments --------------------------------------------------------
  insertSegments(segments: Segment[]): void {
    const stmt = this.sqlite.prepare(
      `INSERT INTO segments (id, rush_id, project_id, start_sec, end_sec, transcript, energy, clarity, relevance, hook_potential, visual_quality, narrative_interest, created_at)
       VALUES ($id, $rushId, $projectId, $start, $end, $transcript, $energy, $clarity, $relevance, $hookPotential, $visualQuality, $narrativeInterest, $createdAt)`
    );
    for (const s of segments) {
      stmt.run({
        $id: s.id,
        $rushId: s.rushId,
        $projectId: s.projectId,
        $start: s.start,
        $end: s.end,
        $transcript: s.transcript,
        $energy: s.energy,
        $clarity: s.clarity,
        $relevance: s.relevance,
        $hookPotential: s.hookPotential,
        $visualQuality: s.visualQuality,
        $narrativeInterest: s.narrativeInterest,
        $createdAt: nowIso(),
      });
    }
  }

  listSegmentsByProject(projectId: string): Segment[] {
    const rows = this.sqlite
      .prepare(`SELECT * FROM segments WHERE project_id = $projectId ORDER BY start_sec ASC`)
      .all({ $projectId: projectId }) as Record<string, unknown>[];
    return rows.map(rowToSegment);
  }

  // ---- style profiles ----------------------------------------------------
  saveStyleProfile(profile: StyleProfile, projectId: string | null): void {
    this.sqlite
      .prepare(
        `INSERT INTO style_profiles (id, project_id, name, source, data_json, created_at)
         VALUES ($id, $projectId, $name, $source, $data, $createdAt)`
      )
      .run({
        $id: profile.id,
        $projectId: projectId,
        $name: profile.name,
        $source: profile.source,
        $data: JSON.stringify(profile),
        $createdAt: nowIso(),
      });
  }

  getStyleProfile(id: string): StyleProfile | null {
    const row = this.sqlite.prepare(`SELECT data_json FROM style_profiles WHERE id = $id`).get({
      $id: id,
    }) as Record<string, unknown> | undefined;
    return row ? (JSON.parse(row.data_json as string) as StyleProfile) : null;
  }

  // ---- briefs --------------------------------------------------------
  createBrief(input: { projectId: string; rawText: string }): Brief {
    const brief: Brief = { id: newId("brief"), projectId: input.projectId, rawText: input.rawText, spec: null, createdAt: nowIso() };
    this.sqlite
      .prepare(`INSERT INTO briefs (id, project_id, raw_text, spec_json, created_at) VALUES ($id, $projectId, $rawText, NULL, $createdAt)`)
      .run({ $id: brief.id, $projectId: brief.projectId, $rawText: brief.rawText, $createdAt: brief.createdAt });
    return brief;
  }

  setBriefSpec(id: string, spec: BriefSpec): void {
    this.sqlite.prepare(`UPDATE briefs SET spec_json = $spec WHERE id = $id`).run({ $spec: JSON.stringify(spec), $id: id });
  }

  getBrief(id: string): Brief | null {
    const row = this.sqlite.prepare(`SELECT * FROM briefs WHERE id = $id`).get({ $id: id }) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      rawText: row.raw_text as string,
      spec: row.spec_json ? (JSON.parse(row.spec_json as string) as BriefSpec) : null,
      createdAt: row.created_at as string,
    };
  }

  // ---- story blueprints ----------------------------------------------
  saveStoryBlueprint(blueprint: StoryBlueprint): void {
    this.sqlite
      .prepare(
        `INSERT INTO story_blueprints (id, project_id, version, data_json, created_at) VALUES ($id, $projectId, $version, $data, $createdAt)`
      )
      .run({
        $id: blueprint.id,
        $projectId: blueprint.projectId,
        $version: blueprint.version,
        $data: JSON.stringify(blueprint),
        $createdAt: nowIso(),
      });
  }

  latestStoryBlueprint(projectId: string): StoryBlueprint | null {
    const row = this.sqlite
      .prepare(`SELECT data_json FROM story_blueprints WHERE project_id = $projectId ORDER BY version DESC LIMIT 1`)
      .get({ $projectId: projectId }) as Record<string, unknown> | undefined;
    return row ? (JSON.parse(row.data_json as string) as StoryBlueprint) : null;
  }

  // ---- edit blueprints -------------------------------------------------
  saveEditBlueprint(blueprint: EditBlueprint): void {
    this.sqlite
      .prepare(
        `INSERT INTO edit_blueprints (id, project_id, story_blueprint_id, version, style_profile_id, data_json, created_at)
         VALUES ($id, $projectId, $storyBlueprintId, $version, $styleProfileId, $data, $createdAt)`
      )
      .run({
        $id: blueprint.id,
        $projectId: blueprint.projectId,
        $storyBlueprintId: blueprint.storyBlueprintId,
        $version: blueprint.version,
        $styleProfileId: blueprint.styleProfileId,
        $data: JSON.stringify(blueprint),
        $createdAt: nowIso(),
      });
  }

  latestEditBlueprint(projectId: string): EditBlueprint | null {
    const row = this.sqlite
      .prepare(`SELECT data_json FROM edit_blueprints WHERE project_id = $projectId ORDER BY version DESC LIMIT 1`)
      .get({ $projectId: projectId }) as Record<string, unknown> | undefined;
    return row ? (JSON.parse(row.data_json as string) as EditBlueprint) : null;
  }

  // ---- renders --------------------------------------------------------
  createRender(input: {
    projectId: string;
    editBlueprintId: string;
    editBlueprintVersion: number;
    kind: RenderVersion["kind"];
  }): RenderVersion {
    const render: RenderVersion = {
      id: newId("render"),
      projectId: input.projectId,
      editBlueprintId: input.editBlueprintId,
      editBlueprintVersion: input.editBlueprintVersion,
      kind: input.kind,
      status: "queued",
      createdAt: nowIso(),
    };
    this.sqlite
      .prepare(
        `INSERT INTO renders (id, project_id, edit_blueprint_id, edit_blueprint_version, kind, status, created_at)
         VALUES ($id, $projectId, $editBlueprintId, $editBlueprintVersion, $kind, 'queued', $createdAt)`
      )
      .run({
        $id: render.id,
        $projectId: render.projectId,
        $editBlueprintId: render.editBlueprintId,
        $editBlueprintVersion: render.editBlueprintVersion,
        $kind: render.kind,
        $createdAt: render.createdAt,
      });
    return render;
  }

  updateRenderStatus(id: string, status: RenderStatus, extra?: { filePath?: string; durationMs?: number; error?: string }): void {
    this.sqlite
      .prepare(
        `UPDATE renders SET status = $status, file_path = COALESCE($filePath, file_path), duration_ms = COALESCE($durationMs, duration_ms), error = $error WHERE id = $id`
      )
      .run({
        $status: status,
        $filePath: extra?.filePath ?? null,
        $durationMs: extra?.durationMs ?? null,
        $error: extra?.error ?? null,
        $id: id,
      });
  }

  getRender(id: string): RenderVersion | null {
    const row = this.sqlite.prepare(`SELECT * FROM renders WHERE id = $id`).get({ $id: id }) as Record<string, unknown> | undefined;
    return row ? rowToRender(row) : null;
  }

  listRendersByProject(projectId: string): RenderVersion[] {
    const rows = this.sqlite
      .prepare(`SELECT * FROM renders WHERE project_id = $projectId ORDER BY created_at ASC`)
      .all({ $projectId: projectId }) as Record<string, unknown>[];
    return rows.map(rowToRender);
  }

  // ---- qc reports -----------------------------------------------------
  saveQcReport(report: QcReport): void {
    this.sqlite
      .prepare(
        `INSERT INTO qc_reports (id, render_id, project_id, scores_json, corrections_json, passed, threshold, human_score, human_notes, created_at)
         VALUES ($id, $renderId, $projectId, $scores, $corrections, $passed, $threshold, $humanScore, $humanNotes, $createdAt)`
      )
      .run({
        $id: report.id,
        $renderId: report.renderId,
        $projectId: report.projectId,
        $scores: JSON.stringify(report.scores),
        $corrections: JSON.stringify(report.corrections),
        $passed: report.passed ? 1 : 0,
        $threshold: report.threshold,
        $humanScore: report.humanScore ?? null,
        $humanNotes: report.humanNotes ?? null,
        $createdAt: report.createdAt,
      });
  }

  getQcReportForRender(renderId: string): QcReport | null {
    const row = this.sqlite
      .prepare(`SELECT * FROM qc_reports WHERE render_id = $renderId ORDER BY created_at DESC LIMIT 1`)
      .get({ $renderId: renderId }) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      renderId: row.render_id as string,
      projectId: row.project_id as string,
      scores: JSON.parse(row.scores_json as string),
      corrections: JSON.parse(row.corrections_json as string),
      passed: Boolean(row.passed),
      threshold: row.threshold as number,
      humanScore: (row.human_score as number | null) ?? undefined,
      humanNotes: (row.human_notes as string | null) ?? undefined,
      createdAt: row.created_at as string,
    };
  }

  recordHumanQcScore(renderId: string, humanScore: number, notes?: string): void {
    this.sqlite
      .prepare(
        `UPDATE qc_reports SET human_score = $score, human_notes = $notes WHERE render_id = $renderId AND id = (SELECT id FROM qc_reports WHERE render_id = $renderId ORDER BY created_at DESC LIMIT 1)`
      )
      .run({ $score: humanScore, $notes: notes ?? null, $renderId: renderId });
  }

  // ---- jobs / progression réelle ---------------------------------------
  startJob(projectId: string, stage: PipelineStage): string {
    const id = newId("job");
    this.sqlite
      .prepare(
        `INSERT INTO jobs (id, project_id, stage, status, started_at, created_at) VALUES ($id, $projectId, $stage, 'running', $startedAt, $createdAt)`
      )
      .run({ $id: id, $projectId: projectId, $stage: stage, $startedAt: nowIso(), $createdAt: nowIso() });
    return id;
  }

  finishJob(jobId: string, status: JobStatus, error?: string): void {
    this.sqlite
      .prepare(`UPDATE jobs SET status = $status, finished_at = $finishedAt, error = $error WHERE id = $id`)
      .run({ $status: status, $finishedAt: nowIso(), $error: error ?? null, $id: jobId });
  }

  latestStagesForProject(projectId: string): Record<string, Record<string, unknown>> {
    const rows = this.sqlite
      .prepare(`SELECT * FROM jobs WHERE project_id = $projectId ORDER BY created_at ASC`)
      .all({ $projectId: projectId }) as Record<string, unknown>[];
    const byStage: Record<string, Record<string, unknown>> = {};
    for (const row of rows) byStage[row.stage as string] = row; // la dernière ligne par stage écrase les précédentes
    return byStage;
  }

  // ---- feedback ---------------------------------------------------------
  recordFeedback(input: {
    projectId: string;
    renderId: string | null;
    type: FeedbackEventType;
    command: ConversationalCommand | null;
    note: string | null;
  }): FeedbackEvent {
    const event: FeedbackEvent = { id: newId("fbk"), createdAt: nowIso(), ...input };
    this.sqlite
      .prepare(
        `INSERT INTO feedback_events (id, project_id, render_id, type, command, note, created_at)
         VALUES ($id, $projectId, $renderId, $type, $command, $note, $createdAt)`
      )
      .run({
        $id: event.id,
        $projectId: event.projectId,
        $renderId: event.renderId,
        $type: event.type,
        $command: event.command,
        $note: event.note,
        $createdAt: event.createdAt,
      });
    return event;
  }

  listFeedbackByProject(projectId: string): FeedbackEvent[] {
    const rows = this.sqlite
      .prepare(`SELECT * FROM feedback_events WHERE project_id = $projectId ORDER BY created_at ASC`)
      .all({ $projectId: projectId }) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      renderId: (r.render_id as string | null) ?? null,
      type: r.type as FeedbackEventType,
      command: (r.command as ConversationalCommand | null) ?? null,
      note: (r.note as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  }

  // ---- media library ------------------------------------------------
  insertMedia(input: { kind: "stock" | "generated" | "user"; projectId: string | null; storagePath: string; tags: string[] }): string {
    const id = newId("media");
    this.sqlite
      .prepare(
        `INSERT INTO media_library (id, kind, project_id, storage_path, tags_json, created_at)
         VALUES ($id, $kind, $projectId, $storagePath, $tags, $createdAt)`
      )
      .run({ $id: id, $kind: input.kind, $projectId: input.projectId, $storagePath: input.storagePath, $tags: JSON.stringify(input.tags), $createdAt: nowIso() });
    return id;
  }

  getMediaById(id: string): { id: string; storagePath: string; tags: string[] } | null {
    const row = this.sqlite.prepare(`SELECT * FROM media_library WHERE id = $id`).get({ $id: id }) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return { id: row.id as string, storagePath: row.storage_path as string, tags: JSON.parse(row.tags_json as string) as string[] };
  }

  listStockMediaByTag(tag: string): { id: string; storagePath: string; tags: string[] }[] {
    const rows = this.sqlite.prepare(`SELECT * FROM media_library WHERE kind = 'stock'`).all() as Record<string, unknown>[];
    return rows
      .map((r) => ({ id: r.id as string, storagePath: r.storage_path as string, tags: JSON.parse(r.tags_json as string) as string[] }))
      .filter((m) => m.tags.includes(tag));
  }

  // ---- render queue (§2, §3, §17, §28 du brief factory) ----------------

  /**
   * Met un projet en file. Idempotent par projet : si un job non-terminal
   * existe déjà pour ce projectId, on le renvoie au lieu d'en créer un
   * second (§17 : trois clics = un seul job). C'est la garantie
   * anti-duplication côté données, indépendante de tout état mémoire.
   */
  enqueueRenderJob(input: {
    projectId: string;
    payload: string;
    priority?: RenderJobPriority;
    profile?: RenderProfile;
    maxAttempts?: number;
  }): RenderJob {
    const existing = this.getActiveRenderJobForProject(input.projectId);
    if (existing) return existing;

    const job: RenderJob = {
      jobId: newId("rjob"),
      projectId: input.projectId,
      priority: input.priority ?? 0,
      status: "queued",
      profile: input.profile ?? "balanced",
      payload: input.payload,
      progress: 0,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      createdAt: nowIso(),
    };
    this.sqlite
      .prepare(
        `INSERT INTO render_queue (job_id, project_id, priority, status, profile, payload, progress, attempts, max_attempts, created_at)
         VALUES ($jobId, $projectId, $priority, 'queued', $profile, $payload, 0, 0, $maxAttempts, $createdAt)`
      )
      .run({
        $jobId: job.jobId,
        $projectId: job.projectId,
        $priority: job.priority,
        $profile: job.profile,
        $payload: job.payload,
        $maxAttempts: job.maxAttempts,
        $createdAt: job.createdAt,
      });
    return job;
  }

  getActiveRenderJobForProject(projectId: string): RenderJob | null {
    const placeholders = TERMINAL_JOB_STATUSES.map((_, i) => `$s${i}`).join(", ");
    const params: Record<string, string> = { $projectId: projectId };
    TERMINAL_JOB_STATUSES.forEach((s, i) => (params[`$s${i}`] = s));
    const row = this.sqlite
      .prepare(
        `SELECT * FROM render_queue WHERE project_id = $projectId AND status NOT IN (${placeholders})
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(params) as Record<string, unknown> | undefined;
    return row ? rowToRenderJob(row) : null;
  }

  getRenderJob(jobId: string): RenderJob | null {
    const row = this.sqlite.prepare(`SELECT * FROM render_queue WHERE job_id = $jobId`).get({ $jobId: jobId }) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToRenderJob(row) : null;
  }

  /**
   * Réclame atomiquement le prochain job de la file pour un worker donné.
   * SQLite n'ayant qu'un seul writer, la transaction IMMEDIATE + le
   * UPDATE conditionné sur `status='queued'` garantissent qu'un job n'est
   * jamais réclamé par deux workers (§2 : aucune double exécution).
   * Renvoie null si la file est vide.
   */
  claimNextRenderJob(workerId: string): RenderJob | null {
    let claimed: RenderJob | null = null;
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const row = this.sqlite
        .prepare(
          `SELECT * FROM render_queue WHERE status = 'queued'
           ORDER BY priority DESC, created_at ASC LIMIT 1`
        )
        .get() as Record<string, unknown> | undefined;
      if (row) {
        const jobId = row.job_id as string;
        const res = this.sqlite
          .prepare(
            `UPDATE render_queue
             SET status = 'preparing', worker_id = $workerId, started_at = COALESCE(started_at, $now),
                 heartbeat_at = $now, attempts = attempts + 1, error = NULL
             WHERE job_id = $jobId AND status = 'queued'`
          )
          .run({ $workerId: workerId, $now: nowIso(), $jobId: jobId });
        if (res.changes === 1) claimed = rowToRenderJob({ ...row, status: "preparing", worker_id: workerId });
      }
      this.sqlite.exec("COMMIT");
    } catch (err) {
      this.sqlite.exec("ROLLBACK");
      throw err;
    }
    return claimed;
  }

  /** Met à jour la progression + heartbeat d'un job en cours (appelé par le worker). */
  updateRenderJobProgress(
    jobId: string,
    update: {
      status?: RenderJobStatus;
      progress?: number;
      currentStage?: string;
      estimatedRemainingMs?: number | null;
      workerPid?: number;
    }
  ): void {
    this.sqlite
      .prepare(
        `UPDATE render_queue SET
           status = COALESCE($status, status),
           progress = COALESCE($progress, progress),
           current_stage = COALESCE($currentStage, current_stage),
           estimated_remaining_ms = CASE WHEN $hasEta = 1 THEN $eta ELSE estimated_remaining_ms END,
           worker_pid = COALESCE($workerPid, worker_pid),
           heartbeat_at = $now
         WHERE job_id = $jobId`
      )
      .run({
        $status: update.status ?? null,
        $progress: update.progress ?? null,
        $currentStage: update.currentStage ?? null,
        $hasEta: update.estimatedRemainingMs !== undefined ? 1 : 0,
        $eta: update.estimatedRemainingMs ?? null,
        $workerPid: update.workerPid ?? null,
        $now: nowIso(),
        $jobId: jobId,
      });
  }

  completeRenderJob(jobId: string, outputPath?: string): void {
    this.sqlite
      .prepare(
        `UPDATE render_queue SET status = 'completed', progress = 100, completed_at = $now,
           output_path = COALESCE($outputPath, output_path), estimated_remaining_ms = 0, error = NULL
         WHERE job_id = $jobId`
      )
      .run({ $now: nowIso(), $outputPath: outputPath ?? null, $jobId: jobId });
  }

  /**
   * Marque un job en échec. S'il reste des tentatives, il repart en file
   * (§28 auto-recovery) ; sinon il devient terminal `failed`. Renvoie true
   * si le job a été remis en file (donc doit être re-dispatché).
   */
  failRenderJob(jobId: string, error: string): boolean {
    const job = this.getRenderJob(jobId);
    if (!job) return false;
    if (job.attempts < job.maxAttempts) {
      this.sqlite
        .prepare(
          `UPDATE render_queue SET status = 'queued', worker_id = NULL, worker_pid = NULL,
             heartbeat_at = NULL, error = $error WHERE job_id = $jobId`
        )
        .run({ $error: error, $jobId: jobId });
      return true;
    }
    this.sqlite
      .prepare(`UPDATE render_queue SET status = 'failed', completed_at = $now, error = $error WHERE job_id = $jobId`)
      .run({ $now: nowIso(), $error: error, $jobId: jobId });
    return false;
  }

  /** Annulation (§18). Renvoie le PID du worker pour que l'appelant puisse le tuer. */
  cancelRenderJob(jobId: string): { workerPid?: number } | null {
    const job = this.getRenderJob(jobId);
    if (!job) return null;
    if (TERMINAL_JOB_STATUSES.includes(job.status)) return { workerPid: job.workerPid };
    this.sqlite
      .prepare(`UPDATE render_queue SET status = 'cancelled', completed_at = $now WHERE job_id = $jobId`)
      .run({ $now: nowIso(), $jobId: jobId });
    return { workerPid: job.workerPid };
  }

  countRunningRenderJobs(): number {
    const placeholders = RUNNING_JOB_STATUSES.map((_, i) => `$s${i}`).join(", ");
    const params: Record<string, string> = {};
    RUNNING_JOB_STATUSES.forEach((s, i) => (params[`$s${i}`] = s));
    const row = this.sqlite
      .prepare(`SELECT COUNT(*) as n FROM render_queue WHERE status IN (${placeholders})`)
      .get(params) as { n: number };
    return row.n;
  }

  listRenderJobs(filter?: { status?: RenderJobStatus }): RenderJob[] {
    const rows = filter?.status
      ? (this.sqlite
          .prepare(`SELECT * FROM render_queue WHERE status = $status ORDER BY priority DESC, created_at ASC`)
          .all({ $status: filter.status }) as Record<string, unknown>[])
      : (this.sqlite
          .prepare(`SELECT * FROM render_queue ORDER BY created_at DESC`)
          .all() as Record<string, unknown>[]);
    return rows.map(rowToRenderJob);
  }

  /**
   * Reprise après crash (§28). Un job "running" dont le heartbeat est plus
   * vieux que `staleMs` a un worker mort (process tué, machine redémarrée).
   * On le remet en file (ou en échec si tentatives épuisées). Renvoie les
   * jobs remis en file, à re-dispatcher. Au démarrage, passer staleMs=0
   * remet en file TOUT job "running" (aucun worker vivant après un
   * redémarrage — les sous-processus ne survivent pas au process parent).
   */
  recoverStaleRenderJobs(staleMs: number): RenderJob[] {
    const placeholders = RUNNING_JOB_STATUSES.map((_, i) => `$s${i}`).join(", ");
    const params: Record<string, string> = {};
    RUNNING_JOB_STATUSES.forEach((s, i) => (params[`$s${i}`] = s));
    const rows = this.sqlite
      .prepare(`SELECT * FROM render_queue WHERE status IN (${placeholders})`)
      .all(params) as Record<string, unknown>[];

    const now = Date.now();
    const recovered: RenderJob[] = [];
    for (const row of rows) {
      const job = rowToRenderJob(row);
      const hb = job.heartbeatAt ? new Date(job.heartbeatAt).getTime() : 0;
      const age = now - hb;
      if (age < staleMs) continue; // worker encore vivant

      if (job.attempts < job.maxAttempts) {
        this.sqlite
          .prepare(
            `UPDATE render_queue SET status = 'queued', worker_id = NULL, worker_pid = NULL,
               heartbeat_at = NULL, error = $error WHERE job_id = $jobId`
          )
          .run({ $error: `Worker perdu (heartbeat > ${(staleMs / 1000).toFixed(0)}s), reprise automatique`, $jobId: job.jobId });
        recovered.push({ ...job, status: "queued" });
      } else {
        this.sqlite
          .prepare(`UPDATE render_queue SET status = 'failed', completed_at = $now, error = $error WHERE job_id = $jobId`)
          .run({ $now: nowIso(), $error: "Worker perdu et tentatives épuisées", $jobId: job.jobId });
        this.setProjectStatus(job.projectId, "failed");
      }
    }
    return recovered;
  }

  // ---- render metrics (§20) --------------------------------------------
  recordRenderMetrics(m: RenderMetrics): void {
    this.sqlite
      .prepare(
        `INSERT INTO render_metrics (id, job_id, project_id, render_id, kind, duration_total_ms, duration_cut_ms,
           duration_concat_ms, duration_habillage_ms, duration_encode_ms, frames_rendered, fps, used_remotion,
           memory_peak_mb, worker_id, created_at)
         VALUES ($id, $jobId, $projectId, $renderId, $kind, $total, $cut, $concat, $habillage, $encode, $frames, $fps,
           $usedRemotion, $memPeak, $workerId, $createdAt)`
      )
      .run({
        $id: newId("rmet"),
        $jobId: m.jobId ?? null,
        $projectId: m.projectId,
        $renderId: m.renderId,
        $kind: m.kind,
        $total: m.durationTotalMs,
        $cut: m.durationCutMs ?? null,
        $concat: m.durationConcatMs ?? null,
        $habillage: m.durationHabillageMs ?? null,
        $encode: m.durationEncodeMs ?? null,
        $frames: m.framesRendered ?? null,
        $fps: m.fps ?? null,
        $usedRemotion: m.usedRemotion ? 1 : 0,
        $memPeak: m.memoryPeakMb ?? null,
        $workerId: m.workerId ?? null,
        $createdAt: m.createdAt,
      });
  }

  listRenderMetricsByProject(projectId: string): RenderMetrics[] {
    const rows = this.sqlite
      .prepare(`SELECT * FROM render_metrics WHERE project_id = $projectId ORDER BY created_at ASC`)
      .all({ $projectId: projectId }) as Record<string, unknown>[];
    return rows.map(rowToRenderMetrics);
  }

  // ---- cost ledger -----------------------------------------------------
  recordCost(entry: CostLedgerEntry): void {
    this.sqlite
      .prepare(
        `INSERT INTO cost_ledger (id, project_id, agent, provider, model, stage, call_type, input_units, input_unit_type, output_units, output_unit_type, duration_ms, cost_micro_usd, is_stub, created_at)
         VALUES ($id, $projectId, $agent, $provider, $model, $stage, $callType, $inputUnits, $inputUnitType, $outputUnits, $outputUnitType, $durationMs, $costMicroUsd, $isStub, $createdAt)`
      )
      .run({
        $id: entry.id,
        $projectId: entry.projectId,
        $agent: entry.agent,
        $provider: entry.provider,
        $model: entry.model,
        $stage: entry.stage,
        $callType: entry.callType,
        $inputUnits: entry.inputUnits,
        $inputUnitType: entry.inputUnitType,
        $outputUnits: entry.outputUnits,
        $outputUnitType: entry.outputUnitType,
        $durationMs: entry.durationMs,
        $costMicroUsd: entry.costMicroUsd,
        $isStub: entry.isStub ? 1 : 0,
        $createdAt: entry.createdAt,
      });
  }

  listCostByProject(projectId: string): CostLedgerEntry[] {
    const rows = this.sqlite
      .prepare(`SELECT * FROM cost_ledger WHERE project_id = $projectId ORDER BY created_at ASC`)
      .all({ $projectId: projectId }) as Record<string, unknown>[];
    return rows.map(rowToCostEntry);
  }

  totalCostMicroUsdByProject(projectId: string): number {
    const row = this.sqlite
      .prepare(`SELECT COALESCE(SUM(cost_micro_usd), 0) as total FROM cost_ledger WHERE project_id = $projectId`)
      .get({ $projectId: projectId }) as { total: number };
    return row.total;
  }
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    status: row.status as ProjectStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToRush(row: Record<string, unknown>): Rush {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    originalFilename: row.original_filename as string,
    storagePath: row.storage_path as string,
    container: row.container as Rush["container"],
    codec: row.codec as Rush["codec"],
    durationSec: row.duration_sec as number,
    hasAudio: Boolean(row.has_audio),
    proxyPath: (row.proxy_path as string | null) ?? undefined,
    proxyReady: Boolean(row.proxy_ready),
    createdAt: row.created_at as string,
  };
}

function rowToSegment(row: Record<string, unknown>): Segment {
  return {
    id: row.id as string,
    rushId: row.rush_id as string,
    projectId: row.project_id as string,
    start: row.start_sec as number,
    end: row.end_sec as number,
    transcript: row.transcript as string,
    energy: row.energy as number,
    clarity: row.clarity as number,
    relevance: row.relevance as number,
    hookPotential: row.hook_potential as number,
    visualQuality: row.visual_quality as number,
    narrativeInterest: row.narrative_interest as number,
  };
}

function rowToRender(row: Record<string, unknown>): RenderVersion {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    editBlueprintId: row.edit_blueprint_id as string,
    editBlueprintVersion: row.edit_blueprint_version as number,
    kind: row.kind as RenderVersion["kind"],
    status: row.status as RenderStatus,
    filePath: (row.file_path as string | null) ?? undefined,
    durationMs: (row.duration_ms as number | null) ?? undefined,
    error: (row.error as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function rowToRenderJob(row: Record<string, unknown>): RenderJob {
  return {
    jobId: row.job_id as string,
    projectId: row.project_id as string,
    priority: row.priority as number,
    status: row.status as RenderJobStatus,
    profile: (row.profile as RenderProfile) ?? "balanced",
    payload: row.payload as string,
    progress: (row.progress as number) ?? 0,
    currentStage: (row.current_stage as string | null) ?? undefined,
    estimatedRemainingMs: (row.estimated_remaining_ms as number | null) ?? undefined,
    attempts: (row.attempts as number) ?? 0,
    maxAttempts: (row.max_attempts as number) ?? 3,
    workerId: (row.worker_id as string | null) ?? undefined,
    workerPid: (row.worker_pid as number | null) ?? undefined,
    heartbeatAt: (row.heartbeat_at as string | null) ?? undefined,
    error: (row.error as string | null) ?? undefined,
    outputPath: (row.output_path as string | null) ?? undefined,
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string | null) ?? undefined,
    completedAt: (row.completed_at as string | null) ?? undefined,
  };
}

function rowToRenderMetrics(row: Record<string, unknown>): RenderMetrics {
  return {
    jobId: (row.job_id as string | null) ?? "",
    projectId: row.project_id as string,
    renderId: row.render_id as string,
    kind: row.kind as "proxy" | "final",
    durationTotalMs: row.duration_total_ms as number,
    durationCutMs: (row.duration_cut_ms as number | null) ?? undefined,
    durationConcatMs: (row.duration_concat_ms as number | null) ?? undefined,
    durationHabillageMs: (row.duration_habillage_ms as number | null) ?? undefined,
    durationEncodeMs: (row.duration_encode_ms as number | null) ?? undefined,
    framesRendered: (row.frames_rendered as number | null) ?? undefined,
    fps: (row.fps as number | null) ?? undefined,
    usedRemotion: Boolean(row.used_remotion),
    memoryPeakMb: (row.memory_peak_mb as number | null) ?? undefined,
    workerId: (row.worker_id as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function rowToCostEntry(row: Record<string, unknown>): CostLedgerEntry {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    agent: row.agent as CostLedgerEntry["agent"],
    provider: row.provider as CostLedgerEntry["provider"],
    model: row.model as string,
    stage: row.stage as string,
    callType: row.call_type as CostLedgerEntry["callType"],
    inputUnits: row.input_units as number,
    inputUnitType: row.input_unit_type as string,
    outputUnits: row.output_units as number,
    outputUnitType: row.output_unit_type as string,
    durationMs: row.duration_ms as number,
    costMicroUsd: row.cost_micro_usd as number,
    isStub: Boolean(row.is_stub),
    createdAt: row.created_at as string,
  };
}

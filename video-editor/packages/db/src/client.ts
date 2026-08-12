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
} from "@video-editor/shared-types";

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

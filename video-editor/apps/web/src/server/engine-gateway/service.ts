import { execFile, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { probe } from "@video-editor/render/dist/ffmpeg.js";
import type { MediaContainer, RenderJobStatus } from "@video-editor/shared-types";
import { getDb } from "../db";
import { startPipelineJob, cancelProjectJob } from "../jobs";
import { resolveStorageRoot } from "../storage";
import { downloadTo, safeFilename } from "./intake";
import { links, type Link } from "./links";

const execFileAsync = promisify(execFile);
const EDIT_CLI = join(process.cwd(), "..", "..", "packages", "pipeline", "dist", "cli-apply-edit.js");

/** Contrat (miroir de @app/video-engine côté produit ; volontairement redéclaré : ce dépôt n'a aucune dépendance vers app-v1). */
export interface GatewayJobRequest {
  externalJobId: string; correlationId: string; kind: "create" | "revision"; attempt?: number;
  inputs: { assetId: string; role: "rush" | "reference" | "image" | "logo" | "audio_note"; filename: string; mimeType: string; sizeBytes: number; url: string; durationSec?: number | null }[];
  brief: string | null; presetId: string; useReferences: boolean; aspectRatio: string; targetDurationMaxSec: number;
  revision?: { parentExternalJobId: string; commands: string[] };
}

export interface GatewayStatus {
  engineJobId: string; state: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  stage: "preparing" | "analyzing" | "editing" | "rendering" | "quality_check" | null; progress: number; etaSec: number | null;
  error?: { code: string; message: string; retryable: boolean };
  result?: { durationSec: number; width: number; height: number; sizeBytes: number };
  costs?: { entries: { provider: string; callType: string; costMicroUsd: number; isStub: boolean }[]; renderComputeSec?: number };
  engineVersion: string;
}

export const REVISION_COMMANDS = ["shorter", "faster", "slower", "more_zooms", "less_zooms"] as const;
export const ENGINE_VERSION = process.env.ENGINE_VERSION ?? "video-editor-1.0";
export const KNOWN_PRESETS = ["preset_premium_clean", "preset_dynamic_social", "preset_aggressive_hype"];
const DURATION_TARGET_RATIO = Number(process.env.ENGINE_DURATION_TARGET_RATIO ?? "0.9");

/** Capacités RÉELLES du moteur actuel (voir docs/AUDIT.md) : publiées telles quelles, jamais embellies. */
export function capabilities() {
  return {
    engine_version: ENGINE_VERSION,
    autonomous_creation: false,                 // StubTtvProvider : aucune génération vidéo réelle
    aspect_ratios: ["9:16"],
    max_duration_sec: 180,
    reference_mode: true,
    revisions: { enabled: true, commands: [...REVISION_COMMANDS] },
    voice_instructions: true,
    presets: KNOWN_PRESETS,
  };
}

declare global { var __gatewayRunners: Map<string, { cancelled: boolean; child?: ChildProcess }> | undefined }
const runners = (): Map<string, { cancelled: boolean; child?: ChildProcess }> => (globalThis.__gatewayRunners ??= new Map());

const EXT: Record<string, MediaContainer> = { mp4: "mp4", mov: "mov", m4v: "m4v", webm: "webm" };
const engineIdOf = (externalJobId: string, attempt: number) => `eng_${externalJobId}_${attempt}`;

export class GatewayError extends Error {
  constructor(readonly status: number, readonly code: string, message?: string) { super(message ?? code); }
}

// ── Soumission ──────────────────────────────────────────────────────────
export function submit(req: GatewayJobRequest): { engineJobId: string } {
  ensureSweeper();
  if (!KNOWN_PRESETS.includes(req.presetId)) throw new GatewayError(422, "unknown_preset");
  if (req.aspectRatio !== "9:16") throw new GatewayError(422, "aspect_ratio_unsupported");
  const attempt = Math.max(1, req.attempt ?? 1);
  const existing = links.byExternal(req.externalJobId);
  if (existing && !((existing.state === "failed" || existing.state === "cancelled") && attempt > existing.attempt)) {
    return { engineJobId: existing.engineJobId };                 // idempotent : jamais de second rendu
  }
  const engineJobId = engineJobId_(req, attempt);

  if (req.kind === "revision") {
    const parent = links.byExternal(req.revision?.parentExternalJobId ?? "");
    if (!parent || parent.state !== "succeeded") throw new GatewayError(409, "parent_not_ready");
    const commands = (req.revision?.commands ?? []).filter((c): c is (typeof REVISION_COMMANDS)[number] => (REVISION_COMMANDS as readonly string[]).includes(c));
    if (commands.length === 0) throw new GatewayError(422, "revision_unsupported");
    const db = getDb();
    if ([...links_activeOnProject(parent.projectId)].length > 0 || db.getActiveRenderJobForProject(parent.projectId)) throw new GatewayError(409, "project_busy");
    const baseline = db.listRendersByProject(parent.projectId).map((r) => r.id);
    links.upsert({ externalJobId: req.externalJobId, engineJobId, kind: "revision", projectId: parent.projectId, attempt, renderQueueJobId: null,
      revisionBaselineRenderIds: baseline, renderId: null, state: "running", errorCode: null, errorMessage: null, retryable: false });
    void runRevision(req.externalJobId, parent.projectId, commands);
    return { engineJobId };
  }

  // Création : l'intake (téléchargement des fichiers) peut durer ; on répond tout de suite, le suivi montre « Préparation ».
  const db = getDb();
  const project = db.createProject({ userId: `app:${req.externalJobId}`, title: (req.brief ?? "Montage").slice(0, 80) });
  links.upsert({ externalJobId: req.externalJobId, engineJobId, kind: "create", projectId: project.id, attempt, renderQueueJobId: null,
    revisionBaselineRenderIds: [], renderId: null, state: "queued", errorCode: null, errorMessage: null, retryable: false });
  runners().set(req.externalJobId, { cancelled: false });
  void intakeAndEnqueue(req, project.id).catch((e: Error) => {
    const code = e instanceof GatewayError ? e.code : /input_|download/.test(e.message) ? "input_download_failed" : "intake_failed";
    links.update(req.externalJobId, { state: "failed", errorCode: code, errorMessage: e.message.slice(0, 300), retryable: !/too_large|not_allowed|forbidden|unreadable/.test(e.message) });
  }).finally(() => runners().delete(req.externalJobId));
  return { engineJobId };
}
const engineJobId_ = (r: GatewayJobRequest, a: number) => engineIdOf(r.externalJobId, a);
function* links_activeOnProject(projectId: string) { for (const [ext] of runners()) { const l = links.byExternal(ext); if (l && l.projectId === projectId && l.state === "running") yield l; } }

async function intakeAndEnqueue(req: GatewayJobRequest, projectId: string): Promise<void> {
  const root = resolveStorageRoot();
  const db = getDb();
  const maxBytes = Number(process.env.ENGINE_MAX_INPUT_BYTES ?? 2.5 * 1024 ** 3);
  const rushes = req.inputs.filter((i) => i.role === "rush");
  const refs = req.inputs.filter((i) => i.role === "reference");
  if (rushes.length === 0) throw new GatewayError(422, "no_rushes");
  if (req.useReferences && refs.length === 0) throw new GatewayError(422, "references_required");

  const state = () => runners().get(req.externalJobId);
  const used = new Set<string>();
  const unique = (name: string, fallback: string) => { let n = safeFilename(name, fallback); let i = 1; while (used.has(n)) n = `${i++}_${safeFilename(name, fallback)}`; used.add(n); return n; };

  for (const r of rushes) {
    if (state()?.cancelled) return;
    const dest = join(root, projectId, "rushes", unique(r.filename, `rush-${r.assetId}.mp4`));
    await downloadTo(r.url, dest, { maxBytes, timeoutMs: 45 * 60_000 });
    let info;
    try { info = await probe(dest); } catch { throw new GatewayError(422, "input_unreadable", `fichier illisible : ${r.filename}`); }
    if (!info.durationSec || info.durationSec <= 0 || !info.videoCodec || info.videoCodec === "unknown") throw new GatewayError(422, "input_unreadable");
    const ext = dest.split(".").pop()?.toLowerCase() ?? "mp4";
    db.createRush({ projectId, originalFilename: r.filename, storagePath: dest, container: EXT[ext] ?? "mp4",
      codec: info.videoCodec === "h264" || info.videoCodec === "hevc" ? (info.videoCodec as "h264") : "unknown", durationSec: info.durationSec, hasAudio: info.hasAudio });
  }
  const refPaths: string[] = [];
  for (const r of refs) {
    if (state()?.cancelled) return;
    const dest = join(root, projectId, "references", unique(r.filename, `ref-${r.assetId}.mp4`));
    await downloadTo(r.url, dest, { maxBytes, timeoutMs: 45 * 60_000 });
    refPaths.push(dest);
  }
  // Images / logos / notes vocales : conservés avec le projet (le moteur ne les exploite pas encore : rien n'est promis côté produit).
  for (const a of req.inputs.filter((i) => ["image", "logo", "audio_note"].includes(i.role))) {
    if (state()?.cancelled) return;
    await downloadTo(a.url, join(root, projectId, "assets", unique(a.filename, `asset-${a.assetId}`)), { maxBytes: 200 * 1024 ** 2, timeoutMs: 10 * 60_000 }).catch(() => undefined);
  }
  if (state()?.cancelled) return;

  const target = Math.max(5, Math.floor(req.targetDurationMaxSec * DURATION_TARGET_RATIO));
  const job = startPipelineJob({
    projectId, presetId: req.presetId,
    // La durée explicite est lue par le Brief Analyzer : on la place EN PREMIER, avant le texte libre de l'utilisateur.
    rawBriefText: `Durée : ${target} secondes. ${req.brief?.trim() || "Monte ces rushs en une vidéo courte, dynamique et prête à publier."}`,
    referenceVideoPaths: req.useReferences && refPaths.length > 0 ? refPaths : undefined,
  });
  links.upsert({ ...links.byExternal(req.externalJobId)!, renderQueueJobId: job.jobId, state: "running" });
}

// ── Révisions (menu fermé de commandes, re-rendu partiel) ──────────────
async function runRevision(externalJobId: string, projectId: string, commands: string[]): Promise<void> {
  const reg = { cancelled: false } as { cancelled: boolean; child?: ChildProcess };
  runners().set(externalJobId, reg);
  try {
    for (const cmd of commands) {
      if (reg.cancelled) return;
      const p = execFileAsync(process.execPath, [EDIT_CLI, projectId, cmd], { env: { ...process.env, VIDEO_EDITOR_STORAGE_ROOT: resolveStorageRoot() }, maxBuffer: 16 * 1024 * 1024 });
      reg.child = p.child;
      let out: { ok?: boolean; error?: string };
      try { out = JSON.parse((await p).stdout.trim().split("\n").pop() ?? "{}"); }
      catch (e) { const so = (e as { stdout?: string }).stdout; out = so ? JSON.parse(so.trim().split("\n").pop() ?? "{}") : { ok: false, error: (e as Error).message }; }
      if (!out.ok) { if (!reg.cancelled) links.update(externalJobId, { state: "failed", errorCode: "revision_failed", errorMessage: String(out.error ?? "échec").slice(0, 300), retryable: false }); return; }
    }
    if (reg.cancelled) return;
    const link = links.byExternal(externalJobId)!;
    const fresh = getDb().listRendersByProject(projectId).filter((r) => r.kind === "final" && r.status === "done" && r.filePath && !link.revisionBaselineRenderIds.includes(r.id));
    const last = fresh.at(-1);
    if (!last) links.update(externalJobId, { state: "failed", errorCode: "revision_no_output", errorMessage: "aucun rendu produit", retryable: false });
    else links.update(externalJobId, { state: "succeeded", renderId: last.id });
  } finally { runners().delete(externalJobId); }
}

// ── Statut ──────────────────────────────────────────────────────────────
const STAGE: Partial<Record<RenderJobStatus, GatewayStatus["stage"]>> = {
  preparing: "preparing", analyzing: "analyzing", processing: "editing", rendering: "rendering", encoding: "rendering", checking: "quality_check",
};

function finalRenderOf(link: Link) {
  const renders = getDb().listRendersByProject(link.projectId).filter((r) => r.kind === "final" && r.status === "done" && r.filePath);
  return link.kind === "revision" ? renders.find((r) => r.id === link.renderId) : renders.at(-1);
}

export async function status(engineJobId: string): Promise<GatewayStatus | null> {
  const link = links.byEngine(engineJobId);
  if (!link) return null;
  const base = { engineJobId, etaSec: null as number | null, engineVersion: ENGINE_VERSION };
  const db = getDb();
  const costs = () => ({ entries: db.listCostByProject(link.projectId).map((c) => ({ provider: c.provider, callType: c.callType, costMicroUsd: c.costMicroUsd, isStub: c.isStub })) });

  if (link.state === "purged") return { ...base, state: "succeeded", stage: null, progress: 100 };   // fichiers supprimés (conservation) : le résultat a déjà été livré
  if (link.state === "failed") return { ...base, state: "failed", stage: null, progress: 0, error: { code: link.errorCode ?? "engine_failed", message: link.errorMessage ?? "échec", retryable: link.retryable } };
  if (link.state === "cancelled") return { ...base, state: "cancelled", stage: null, progress: 0 };

  if (link.kind === "revision") {
    if (link.state === "running") {
      if (!runners().has(link.externalJobId)) { links.update(link.externalJobId, { state: "failed", errorCode: "gateway_restarted", errorMessage: "redémarrage pendant la révision", retryable: true }); return status(engineJobId); }
      return { ...base, state: "running", stage: "editing", progress: 40 };
    }
    return succeeded(link, base, costs);
  }

  if (link.state === "succeeded") return succeeded(link, base, costs);
  if (!link.renderQueueJobId) {
    if (!runners().has(link.externalJobId)) { links.update(link.externalJobId, { state: "failed", errorCode: "gateway_restarted", errorMessage: "redémarrage pendant la préparation", retryable: true }); return status(engineJobId); }
    return { ...base, state: "running", stage: "preparing", progress: 1 };
  }
  const q = db.getRenderJob(link.renderQueueJobId);
  if (!q) { links.update(link.externalJobId, { state: "failed", errorCode: "queue_job_missing", errorMessage: "job de rendu introuvable", retryable: true }); return status(engineJobId); }
  switch (q.status) {
    case "queued": return { ...base, state: "queued", stage: "preparing", progress: Math.max(1, q.progress) };
    case "completed": links.update(link.externalJobId, { state: "succeeded" }); return succeeded({ ...link, state: "succeeded" }, base, costs);
    case "cancelled": links.update(link.externalJobId, { state: "cancelled" }); return { ...base, state: "cancelled", stage: null, progress: 0 };
    case "failed": {
      const msg = (q as { error?: string }).error ?? "échec du rendu";
      links.update(link.externalJobId, { state: "failed", errorCode: "render_failed", errorMessage: msg.slice(0, 300), retryable: false });
      return status(engineJobId);
    }
    default: return { ...base, state: "running", stage: STAGE[q.status] ?? "editing", progress: q.progress, etaSec: q.estimatedRemainingMs ? Math.round(q.estimatedRemainingMs / 1000) : null };
  }
}

async function succeeded(link: Link, base: { engineJobId: string; etaSec: number | null; engineVersion: string }, costs: () => GatewayStatus["costs"]): Promise<GatewayStatus> {
  const r = finalRenderOf(link);
  if (!r?.filePath || !existsSync(r.filePath)) {
    links.update(link.externalJobId, { state: "failed", errorCode: "render_missing", errorMessage: "fichier final introuvable", retryable: true });
    return { ...base, state: "failed", stage: null, progress: 0, error: { code: "render_missing", message: "fichier final introuvable", retryable: true } };
  }
  const info = await probe(r.filePath);
  return { ...base, state: "succeeded", stage: null, progress: 100, costs: costs(), result: { durationSec: info.durationSec, width: info.width, height: info.height, sizeBytes: (await stat(r.filePath)).size } };
}

// ── Annulation / fichiers ───────────────────────────────────────────────
export function cancel(engineJobId: string): boolean {
  const link = links.byEngine(engineJobId);
  if (!link) return false;
  if (link.state === "succeeded" || link.state === "failed" || link.state === "cancelled") return true;
  const r = runners().get(link.externalJobId);
  if (r) { r.cancelled = true; r.child?.kill("SIGTERM"); }
  if (link.kind === "create") cancelProjectJob(link.projectId);
  links.update(link.externalJobId, { state: "cancelled" });
  return true;
}

export function resultFile(engineJobId: string): string | null {
  const link = links.byEngine(engineJobId);
  if (!link || link.state !== "succeeded") return null;
  return finalRenderOf(link)?.filePath ?? null;
}

export async function thumbnailFile(engineJobId: string): Promise<string | null> {
  const mp4 = resultFile(engineJobId);
  if (!mp4) return null;
  const out = mp4.replace(/\.mp4$/, ".jpg");
  if (!existsSync(out)) {
    await mkdir(join(out, ".."), { recursive: true });
    await execFileAsync("ffmpeg", ["-y", "-ss", "1", "-i", mp4, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "4", out]);
    if (!existsSync(out)) { await execFileAsync("ffmpeg", ["-y", "-i", mp4, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "4", out]); }
  }
  return out;
}
void readFile; void writeFile;


// ── Conservation : suppression des fichiers du moteur ───────────────────
const RETENTION_HOURS = Number(process.env.ENGINE_RETENTION_HOURS ?? "24");

/** Supprime tous les fichiers du projet moteur lié à ce job (rushs téléchargés, intermédiaires, rendus). Idempotent. */
export async function purge(engineJobId: string): Promise<boolean> {
  const link = links.byEngine(engineJobId);
  if (!link) return false;
  if (link.state === "queued" || link.state === "running") throw new GatewayError(409, "job_active");
  await rm(join(resolveStorageRoot(), link.projectId), { recursive: true, force: true });
  if (link.state === "succeeded" || link.state === "failed" || link.state === "cancelled") {
    links.update(link.externalJobId, { state: link.state === "succeeded" ? "purged" : link.state });
  }
  return true;
}

/** Filet de sécurité : tout job de l'app plus vieux que la durée de conservation est purgé, même si l'orchestrateur n'a pas pu le faire. */
export async function sweepExpired(now = Date.now()): Promise<number> {
  let n = 0;
  for (const l of links.all()) {
    if (l.state === "queued" || l.state === "running" || runners().has(l.externalJobId)) continue;
    if (now - new Date(l.createdAt).getTime() < RETENTION_HOURS * 3600_000) continue;
    const dir = join(resolveStorageRoot(), l.projectId);
    if (!existsSync(dir)) continue;
    await rm(dir, { recursive: true, force: true });
    if (l.state === "succeeded") links.update(l.externalJobId, { state: "purged" });
    n++;
  }
  return n;
}

declare global { var __gatewaySweeper: ReturnType<typeof setInterval> | undefined }
export function ensureSweeper(): void {
  if (globalThis.__gatewaySweeper) return;
  void sweepExpired().catch(() => undefined);
  globalThis.__gatewaySweeper = setInterval(() => { void sweepExpired().catch(() => undefined); }, 10 * 60_000);
  globalThis.__gatewaySweeper.unref?.();
}

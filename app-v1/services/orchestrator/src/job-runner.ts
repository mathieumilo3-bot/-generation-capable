import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { planRevision } from "@app/domain";
import { EngineError, mapEngineCosts, stageToJobStatus, type EngineClient, type EngineJobRequest, type EngineJobStatus } from "@app/video-engine";
import type { BlobStore } from "./blobs.ts";
import type { OrchestratorConfig } from "./config.ts";
import type { ClaimedJob, Store } from "./store.ts";

export type RunOutcome = "completed" | "failed" | "requeued" | "cancelled";

export interface RunnerDeps {
  store: Store;
  engine: EngineClient;
  blobs: BlobStore;
  cfg: Pick<OrchestratorConfig, "STATUS_POLL_MS" | "LEASE_SECONDS" | "JOB_TIMEOUT_MS" | "ENGINE_FLAKY_TOLERANCE" | "ASSET_URL_TTL_SECONDS" | "USD_EUR" | "RENDER_COST_MICRO_EUR_PER_SEC" | "STORAGE_COST_MICRO_EUR_PER_GB_MONTH">;
  /** Commandes de révision supportées par le moteur (capacités synchronisées). */
  revisionCommands: () => string[];
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  tmpDir?: string;
  log?: (level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) => void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Exécute UN job du claim à la livraison. Idempotent de bout en bout :
 *  - la soumission au moteur est idempotente par externalJobId (un retry ne re-rend jamais) ;
 *  - la facturation (hold → capture / release) est faite par la base, une seule fois, quel que soit le nombre de passages.
 * Un job n'est jamais « perdu » : si ce processus meurt, le bail expire et svc_requeue_stale_jobs le relance.
 */
export async function runJob(job: ClaimedJob, d: RunnerDeps): Promise<RunOutcome> {
  const log = d.log ?? (() => undefined);
  const sleep = d.sleep ?? wait;
  const now = d.now ?? Date.now;
  const { store, engine } = d;
  const ev = (level: "info" | "warn" | "error", stage: string, msg: string, data?: Record<string, unknown>) =>
    store.event(job.job_id, level, stage, msg, data).catch(() => undefined);

  const fail = async (code: string, message: string, retryable: boolean): Promise<RunOutcome> => {
    const r = await store.fail({ jobId: job.job_id, code, message, retryable });
    log(retryable ? "warn" : "error", "job en échec", { job: job.job_id, code, retryable, requeued: r.requeued });
    return r.requeued ? "requeued" : r.status === "cancelled" ? "cancelled" : "failed";
  };

  // ── 1. Requête moteur ────────────────────────────────────────────────
  let request: EngineJobRequest;
  try {
    const m = job.input_manifest;
    const assets = m.assets ?? [];
    if (job.kind === "create" && !assets.some((a) => a.kind === "raw")) return await fail("no_files", "manifeste sans rush", false);

    let revision: EngineJobRequest["revision"];
    if (job.kind === "revision") {
      const instruction = m.revision?.instruction ?? job.instructions ?? "";
      const plan = planRevision(instruction, d.revisionCommands());
      if (plan.commands.length === 0) return await fail("revision_unsupported", `aucune commande supportée dans « ${instruction.slice(0, 80)} »`, false);
      if (plan.hasUnsupportedParts) await ev("warn", "revision", "Une partie de la demande n'est pas prise en charge par le moteur ; seules les commandes reconnues sont appliquées", { commands: plan.commands });
      revision = { parentExternalJobId: m.revision!.parent_job_id, commands: plan.commands };
    }
    request = {
      externalJobId: job.job_id, correlationId: job.correlation_id, kind: job.kind, attempt: job.attempt,
      inputs: await Promise.all(assets.map(async (a) => ({
        assetId: a.asset_id, role: a.kind === "raw" ? "rush" : a.kind, filename: a.filename, mimeType: a.mime_type, sizeBytes: a.size_bytes, durationSec: a.duration_sec,
        url: await d.blobs.signedDownloadUrl(a.bucket, a.path, d.cfg.ASSET_URL_TTL_SECONDS),
      }))),
      brief: job.instructions ?? m.brief ?? null,
      presetId: m.method?.engine_config?.preset_id ?? "preset_dynamic_social",
      useReferences: m.method?.engine_config?.use_references === true,
      aspectRatio: job.aspect_ratio, targetDurationMaxSec: job.requested_duration_sec, revision,
    };
  } catch (e) {
    return fail("preparation_failed", (e as Error).message, true);
  }

  // ── 2. Soumission (idempotente) ──────────────────────────────────────
  let engineJobId: string;
  try {
    engineJobId = (await engine.submit(request)).engineJobId;
  } catch (e) {
    const err = e as EngineError;
    return fail(err.kind === "rejected" ? "engine_rejected" : "engine_unavailable", err.message, err.retryable ?? true);
  }
  await ev("info", "engine", "Soumis au moteur", { engine_job: engineJobId, attempt: job.attempt });
  await store.progress({ jobId: job.job_id, status: "preparing", progress: 1, engineJobRef: engineJobId, leaseSeconds: d.cfg.LEASE_SECONDS });

  // ── 3. Suivi ─────────────────────────────────────────────────────────
  const startedAt = now();
  let flaky = 0;
  let status: EngineJobStatus | null = null;
  for (;;) {
    if (now() - startedAt > d.cfg.JOB_TIMEOUT_MS) {
      await engine.cancel(engineJobId).catch(() => undefined);
      return fail("engine_timeout", "durée maximale dépassée", true);
    }
    try {
      status = await engine.status(engineJobId);
      flaky = 0;
    } catch (e) {
      const err = e as EngineError;
      if (!(err.retryable ?? true) || ++flaky > d.cfg.ENGINE_FLAKY_TOLERANCE) return fail("engine_unreachable", err.message, true);
      await sleep(d.cfg.STATUS_POLL_MS);
      continue;
    }

    if (status.state === "succeeded") break;
    if (status.state === "failed") return fail(status.error?.code ?? "engine_failed", status.error?.message ?? "échec moteur", status.error?.retryable ?? false);
    if (status.state === "cancelled") {
      await store.cancelled(job.job_id);
      return "cancelled";
    }

    const p = await store.progress({
      jobId: job.job_id, status: stageToJobStatus(status.stage), progress: status.progress, stage: status.stage,
      engineVersion: status.engineVersion, leaseSeconds: d.cfg.LEASE_SECONDS,
    });
    if (!p.ok) return "failed";                       // job déjà terminal (annulé/relâché ailleurs) : on s'arrête sans rien écrire
    if (p.cancel_requested) {
      await engine.cancel(engineJobId).catch(() => undefined);
      await store.cancelled(job.job_id);
      await ev("info", "cancel", "Annulation confirmée, montant libéré");
      return "cancelled";
    }
    await sleep(d.cfg.STATUS_POLL_MS);
  }

  // ── 4. Livraison ─────────────────────────────────────────────────────
  const tmp = join(d.tmpDir ?? tmpdir(), `render-${job.job_id}.mp4`);
  try {
    await store.progress({ jobId: job.job_id, status: "quality_check", progress: 98, stage: "delivery", leaseSeconds: d.cfg.LEASE_SECONDS });
    const res = await engine.result(engineJobId);
    await pipeline(Readable.fromWeb(res.stream as never), createWriteStream(tmp));
    const { stat } = await import("node:fs/promises");
    const size = (await stat(tmp)).size;
    if (size <= 0 || (res.size > 0 && res.size !== size)) throw new Error(`fichier incomplet (${size}/${res.size})`);

    const base = `${job.user_id}/${job.project_id}/${job.version_id}`;
    const renderPath = `${base}/render.mp4`;
    await d.blobs.uploadFile("renders", renderPath, tmp, "video/mp4");

    let thumbPath: string | null = null;
    try {
      const jpg = await engine.thumbnail(engineJobId);
      thumbPath = `${job.user_id}/${job.project_id}/${job.version_id}.jpg`;
      await d.blobs.uploadBytes("thumbnails", thumbPath, jpg, "image/jpeg");
    } catch { thumbPath = null; }       // miniature facultative : jamais bloquante

    const costs = mapEngineCosts(status.costs, {
      usdToEur: d.cfg.USD_EUR, renderComputeMicroEurPerSec: d.cfg.RENDER_COST_MICRO_EUR_PER_SEC,
      storageBytes: size, storageMicroEurPerGbMonth: d.cfg.STORAGE_COST_MICRO_EUR_PER_GB_MONTH,
    });
    await store.recordCosts(job.job_id, costs as unknown as Record<string, number>, d.cfg.USD_EUR);

    const r = status.result ?? { durationSec: 0, width: 0, height: 0, sizeBytes: size };
    await store.complete({ jobId: job.job_id, renderPath, thumbnailPath: thumbPath, durationSec: r.durationSec, width: r.width, height: r.height, sizeBytes: size });
    log("info", "job livré", { job: job.job_id, size });
    return "completed";
  } catch (e) {
    return fail("delivery_failed", (e as Error).message, true);
  } finally {
    await rm(tmp, { force: true }).catch(() => undefined);
  }
}

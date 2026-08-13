import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  BriefSpec,
  EditBlueprint,
  PipelineStage,
  QcReport,
  RenderVersion,
  Segment,
  StoryBlueprint,
  StyleProfile,
  RenderProfile,
} from "@video-editor/shared-types";
import { RENDER_PROFILE_PARAMS } from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import type { ModelRouter } from "@video-editor/model-router";
import { recordProviderCall } from "@video-editor/cost-ledger";
import { generateProxy, assembleFromBlueprint, resolveStorageRoot } from "@video-editor/render";
import {
  transcribeRush,
  runVideoAnalyzer,
  resolveStyleProfile,
  runBriefAnalyzer,
  runStoryDirector,
  runEditor,
  runBrollDirector,
  runCaptionDirector,
  runSoundDesigner,
  runCreativeDirector,
  runQualityControl,
  type RushTranscript,
} from "@video-editor/agents";
import type { CreativeReview } from "@video-editor/agents";
import { applyCorrection } from "./apply-correction.js";

export interface RunPipelineInput {
  projectId: string;
  rawBriefText: string;
  presetId?: string;
  referenceVideoPaths?: string[];
  width?: number;
  height?: number;
  fps?: number;
  /** Profil de rendu (§10) — vitesse/qualité. Défaut balanced (comportement historique). */
  profile?: RenderProfile;
}

export interface RunPipelineResult {
  finalRender: RenderVersion;
  proxyRender: RenderVersion;
  qcReport: QcReport;
  editBlueprint: EditBlueprint;
  briefSpec: BriefSpec;
  styleProfile: StyleProfile;
  warnings: string[];
}

export type ProgressCallback = (stage: PipelineStage, status: "start" | "done" | "failed") => void;

/**
 * Orchestrateur bout-en-bout (§8 du brief). Chaque étape écrit une ligne
 * dans `jobs` (progression réelle interrogeable par l'UI, jamais une
 * barre simulée) et s'arrête net — statut projet à "failed" — à la
 * première erreur plutôt que de continuer sur un état incohérent.
 * upload/storage sont des marqueurs : les fichiers sont déjà sur disque
 * quand cette fonction démarre (ingestion faite par l'appelant, voir
 * apps/web/src/server ou demo.ts).
 */
export async function runPipeline(db: Db, router: ModelRouter, input: RunPipelineInput, onProgress?: ProgressCallback): Promise<RunPipelineResult> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1920;
  const fps = input.fps ?? 30;
  const warnings: string[] = [];
  const profileParams = RENDER_PROFILE_PARAMS[input.profile ?? "balanced"];
  const jobId = process.env.VIDEO_EDITOR_JOB_ID; // pour rattacher les métriques au job de queue

  db.setProjectStatus(input.projectId, "processing");

  const STAGE_TIMEOUTS: Record<PipelineStage, number> = {
    upload: 30000,
    storage: 30000,
    proxy_generation: 180000, // 3min per rush
    transcription: 180000,
    video_analysis: 180000,
    style_analysis: 120000,
    brief_analysis: 120000,
    story_blueprint: 120000,
    edit_blueprint: 60000,
    broll: 60000,
    captions: 60000,
    sound: 60000,
    creative_review: 120000,
    proxy_render: 600000, // 10min for low-res
    quality_control: 120000,
    correction: 300000, // 5min for QC loop
    final_render: 1200000, // 20min for full HD
    delivery: 30000,
  };

  const runStage = async <T>(stage: PipelineStage, fn: () => Promise<T>): Promise<T> => {
    onProgress?.(stage, "start");
    const jobId = db.startJob(input.projectId, stage);
    const timeout = STAGE_TIMEOUTS[stage] ?? 300000;
    const t0 = Date.now();

    try {
      let completed = false;
      const promise = fn();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          if (!completed) {
            const elapsed = Date.now() - t0;
            reject(new Error(`Stage ${stage} timeout after ${(elapsed / 1000).toFixed(0)}s (limit: ${(timeout / 1000).toFixed(0)}s)`));
          }
        }, timeout);
      });

      const result = await Promise.race([promise, timeoutPromise]);
      completed = true;
      const elapsed = Date.now() - t0;
      db.finishJob(jobId, "completed");
      onProgress?.(stage, "done");
      console.log(`[pipeline] ${stage} completed in ${(elapsed / 1000).toFixed(1)}s`);
      return result;
    } catch (err) {
      const elapsed = Date.now() - t0;
      const errMsg = (err as Error).message;
      console.error(`[pipeline] ${stage} failed after ${(elapsed / 1000).toFixed(1)}s: ${errMsg}`);
      db.finishJob(jobId, "failed", errMsg);
      db.setProjectStatus(input.projectId, "failed");
      onProgress?.(stage, "failed");
      throw err;
    }
  };

  const projectWorkDir = join(resolveStorageRoot(), input.projectId, "work");

  try {
    await runStage("upload", async () => undefined);
    await runStage("storage", async () => undefined);

    const rushes = db.listRushesByProject(input.projectId);
    if (rushes.length === 0) throw new Error("Aucun rush pour ce projet — impossible de lancer le pipeline.");

    await runStage("proxy_generation", async () => {
      for (const rush of rushes) {
        if (!rush.proxyReady) {
          const proxyPath = join(dirname(rush.storagePath), `${rush.id}_proxy.mp4`);
          await generateProxy(rush.storagePath, proxyPath);
          db.setRushProxy(rush.id, proxyPath);
        }
      }
    });
    const rushesWithProxy = db.listRushesByProject(input.projectId);

    const transcripts = new Map<string, RushTranscript>();
    await runStage("transcription", async () => {
      for (const rush of rushesWithProxy) {
        transcripts.set(rush.id, await transcribeRush(db, router, input.projectId, rush));
      }
    });

    const allSegments: Segment[] = [];
    await runStage("video_analysis", async () => {
      for (const rush of rushesWithProxy) {
        const segs = await runVideoAnalyzer(db, router, input.projectId, rush, transcripts.get(rush.id)!);
        allSegments.push(...segs);
      }
      if (allSegments.length === 0) {
        throw new Error("Aucun segment exploitable détecté (rushs entièrement silencieux ou trop courts).");
      }
      db.insertSegments(allSegments);
    });

    let styleProfile!: StyleProfile;
    await runStage("style_analysis", async () => {
      styleProfile = await resolveStyleProfile(db, input.projectId, {
        presetId: input.presetId,
        referenceVideoPaths: input.referenceVideoPaths,
      });
    });

    let briefSpec!: BriefSpec;
    await runStage("brief_analysis", async () => {
      const brief = db.createBrief({ projectId: input.projectId, rawText: input.rawBriefText });
      briefSpec = await runBriefAnalyzer(db, router, input.projectId, input.rawBriefText);
      db.setBriefSpec(brief.id, briefSpec);
    });

    let storyBlueprint!: StoryBlueprint;
    await runStage("story_blueprint", async () => {
      storyBlueprint = await runStoryDirector(db, router, input.projectId, allSegments, briefSpec, styleProfile, 1);
    });

    const segmentsById = new Map(allSegments.map((s) => [s.id, s]));
    let editBlueprint!: EditBlueprint;
    await runStage("edit_blueprint", async () => {
      editBlueprint = runEditor(db, input.projectId, storyBlueprint, segmentsById, styleProfile, briefSpec, 1);
    });

    await runStage("broll", async () => {
      editBlueprint = runBrollDirector(db, editBlueprint);
    });

    await runStage("captions", async () => {
      editBlueprint = runCaptionDirector(editBlueprint, segmentsById, styleProfile);
    });

    let musicFilePath: string | null = null;
    await runStage("sound", async () => {
      const result = runSoundDesigner(db, editBlueprint, styleProfile);
      editBlueprint = result.editBlueprint;
      musicFilePath = result.musicFilePath;
    });

    let creativeReview!: CreativeReview;
    await runStage("creative_review", async () => {
      creativeReview = runCreativeDirector(editBlueprint, styleProfile, briefSpec);
      for (const note of creativeReview.notes) warnings.push(`[creative_review] ${note}`);
    });

    const rushPathById = Object.fromEntries(rushesWithProxy.map((r) => [r.id, r.storagePath]));

    const renderVersion = async (kind: "proxy" | "final", blueprint: EditBlueprint): Promise<RenderVersion> => {
      const renderRow = db.createRender({
        projectId: input.projectId,
        editBlueprintId: blueprint.id,
        editBlueprintVersion: blueprint.version,
        kind,
      });
      db.updateRenderStatus(renderRow.id, "rendering");
      const workDir = join(projectWorkDir, renderRow.id);
      const outputPath = join(resolveStorageRoot(), input.projectId, "renders", `${renderRow.id}.mp4`);
      await mkdir(dirname(outputPath), { recursive: true });
      const start = Date.now();
      try {
        const result = await assembleFromBlueprint(blueprint, outputPath, {
          width,
          height,
          fps,
          workDir,
          captionStyle: styleProfile.captionStyle,
          rushPathById,
          musicFilePath,
          musicVolumeDb: editBlueprint.music?.volumeDb,
          profile: {
            cutPreset: profileParams.cutPreset,
            cutCrf: profileParams.cutCrf,
            finalPreset: profileParams.finalPreset,
            finalCrf: profileParams.finalCrf,
            remotionConcurrency: profileParams.remotionConcurrency,
          },
        });
        warnings.push(...result.warnings);
        const durationMs = Date.now() - start;
        db.updateRenderStatus(renderRow.id, "done", { filePath: result.outputPath, durationMs });

        // Métriques réelles (§20) — comprendre POURQUOI un rendu est lent.
        db.recordRenderMetrics({
          jobId: jobId ?? "",
          projectId: input.projectId,
          renderId: renderRow.id,
          kind,
          durationTotalMs: durationMs,
          durationCutMs: result.timings.cutMs,
          durationConcatMs: result.timings.concatMs,
          durationHabillageMs: result.timings.habillageMs,
          durationEncodeMs: result.timings.encodeMs,
          framesRendered: result.framesRendered,
          fps: result.framesRendered ? Math.round((result.framesRendered / durationMs) * 1000 * 10) / 10 : undefined,
          usedRemotion: result.usedRemotionHabillage,
          memoryPeakMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
          workerId: process.env.HOSTNAME ?? undefined,
          createdAt: new Date().toISOString(),
        });
        recordProviderCall(db, {
          projectId: input.projectId,
          agent: "render_engine",
          stage: kind === "proxy" ? "proxy_render" : "final_render",
          result: {
            data: null,
            provider: "internal_ffmpeg",
            model: result.usedRemotionHabillage ? "ffmpeg+remotion" : "ffmpeg-only",
            inputUnits: blueprint.totalDurationSec,
            inputUnitType: "seconds_timeline",
            outputUnits: result.durationSec,
            outputUnitType: "seconds_output",
            durationMs,
            costMicroUsd: 0,
            isStub: false,
          },
        });
        return { ...renderRow, status: "done", filePath: result.outputPath, durationMs };
      } catch (err) {
        db.updateRenderStatus(renderRow.id, "failed", { error: (err as Error).message });
        throw err;
      }
    };

    let proxyRender!: RenderVersion;
    await runStage("proxy_render", async () => {
      proxyRender = await renderVersion("proxy", editBlueprint);
    });

    let qcReport!: QcReport;
    await runStage("quality_control", async () => {
      qcReport = runQualityControl(db, proxyRender.id, input.projectId, editBlueprint, segmentsById, styleProfile, briefSpec, creativeReview);
    });

    await runStage("correction", async () => {
      if (qcReport.passed || qcReport.corrections.length === 0) return;
      const correction = qcReport.corrections[0]!;
      const applied = applyCorrection(db, editBlueprint, correction, styleProfile, segmentsById);
      const candidateBlueprint = applied.blueprint;
      if (applied.musicFilePath) musicFilePath = applied.musicFilePath;
      const candidateRender = await renderVersion("proxy", candidateBlueprint);
      const candidateQc = runQualityControl(db, candidateRender.id, input.projectId, candidateBlueprint, segmentsById, styleProfile, briefSpec, creativeReview);
      if (candidateQc.scores.overall > qcReport.scores.overall) {
        editBlueprint = candidateBlueprint;
        qcReport = candidateQc;
        proxyRender = candidateRender;
      } else {
        warnings.push("Correction automatique n'a pas amélioré le score — version précédente conservée (§5 Agent 09).");
      }
    });

    let finalRender!: RenderVersion;
    await runStage("final_render", async () => {
      finalRender = await renderVersion("final", editBlueprint);
    });

    await runStage("delivery", async () => {
      db.setProjectStatus(input.projectId, "ready");
    });

    return { finalRender, proxyRender, qcReport, editBlueprint, briefSpec, styleProfile, warnings };
  } finally {
    // Auto-cleanup temporary work directory (with retry for Remotion cache lock)
    try {
      console.log(`[pipeline] Cleaning up work directory: ${projectWorkDir}`);
      let retries = 3;
      while (retries > 0) {
        try {
          await rm(projectWorkDir, { recursive: true, force: true });
          console.log(`[pipeline] Work directory cleaned up successfully`);
          break;
        } catch (err) {
          retries--;
          if (retries > 0) {
            console.log(`[pipeline] Cleanup retry ${4 - retries}/3 (${(err as Error).message})`);
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            console.warn(`[pipeline] Failed to cleanup after 3 retries: ${(err as Error).message}`);
          }
        }
      }
    } catch (err) {
      console.warn(`[pipeline] Unexpected cleanup error: ${(err as Error).message}`);
    }
  }
}

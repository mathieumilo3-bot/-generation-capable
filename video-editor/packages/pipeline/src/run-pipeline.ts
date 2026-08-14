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
import { RENDER_PROFILE_PARAMS, PIPELINE_STAGES, STAGE_WEIGHTS } from "@video-editor/shared-types";
import type { CreativePlan } from "@video-editor/shared-types";
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
  runCreativeBrain,
  runCreativeCritic,
  resolveTargetDurationSec,
  type RushTranscript,
} from "@video-editor/agents";
import type { CreativeReview } from "@video-editor/agents";

/** Bande de progression globale [start,end] d'une étape, d'après ses poids réels. */
function stageBand(stage: PipelineStage): { start: number; end: number } {
  const total = PIPELINE_STAGES.reduce((s, x) => s + STAGE_WEIGHTS[x], 0);
  let before = 0;
  for (const s of PIPELINE_STAGES) {
    if (s === stage) break;
    before += STAGE_WEIGHTS[s];
  }
  return { start: (before / total) * 100, end: ((before + STAGE_WEIGHTS[stage]) / total) * 100 };
}
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
  /** Résumé éditorial lisible : POURQUOI la vidéo ressemble à ça (§18 observabilité). */
  editorialSummary: string[];
}

/**
 * Construit le résumé éditorial — les décisions RÉELLES visibles dans le
 * MP4 final (§18). Permet de vérifier d'un coup d'œil que le cerveau a
 * réellement monté, pas juste exécuté un pipeline.
 */
function buildEditorialSummary(
  editBlueprint: EditBlueprint,
  storyBlueprint: StoryBlueprint,
  segmentsById: Map<string, Segment>,
  totalSegments: number,
  plan: CreativePlan | undefined,
  durationExplicit: boolean
): string[] {
  const clips = editBlueprint.clips;
  const avgShot = clips.length > 0 ? clips.reduce((s, c) => s + c.outDuration, 0) / clips.length : 0;
  const zoomCount = clips.filter((c) => c.zoomKeyframes.length > 0).length;
  const brollResolved = editBlueprint.brollSlots.filter((s) => s.resolvedSource !== null).length;
  const hookClip = clips.find((c) => c.role === "hook") ?? clips[0];
  const hookSeg = hookClip ? segmentsById.get(hookClip.segmentId) : undefined;
  const hookText = hookSeg?.transcript?.slice(0, 60).trim();
  const removed = storyBlueprint.discardedSegmentIds.length;
  const director = plan ? (plan.hybridApproach ? "LLM + heuristique" : "heuristique") : "heuristique (cerveau indisponible)";

  return [
    `DURÉE     : ${editBlueprint.totalDurationSec.toFixed(1)}s (${durationExplicit ? "demandée" : "dérivée du contenu"})`,
    `DIRECTEUR : ${director}${plan ? ` — confiance ${(plan.confidence * 100).toFixed(0)}%` : ""}`,
    `HOOK      : ${hookClip ? `plan ${hookClip.role}` : "n/a"}${hookText ? ` — « ${hookText}${hookText.length >= 60 ? "…" : ""} »` : ""}`,
    `CUTS      : ${removed} segment(s) retiré(s) sur ${totalSegments} analysés → ${clips.length} plans montés`,
    `RYTHME    : ${avgShot.toFixed(1)}s par plan en moyenne`,
    `ZOOMS     : ${zoomCount} punch-in`,
    `B-ROLL    : ${brollResolved} intervention(s) résolue(s)`,
    `CAPTIONS  : ${editBlueprint.captions.length} cues${editBlueprint.captions.length === 0 ? " (pas de STT — sous-titres désactivés honnêtement)" : ""}`,
    `MUSIQUE   : ${editBlueprint.music?.title ?? "aucune"}`,
    `FIN       : ${plan?.endingStrategy ?? "payoff"}`,
  ];
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

      // Une durée explicite est TOUJOURS respectée (jamais rognée en
      // silence) — mais si le contenu réellement disponible est plus
      // court, on le dit clairement plutôt que de fabriquer du contenu
      // (boucle/freeze) ou de tronquer sans prévenir.
      if (briefSpec.targetDurationSec != null) {
        const d = resolveTargetDurationSec(briefSpec, allSegments);
        if (d.contentInsufficient) {
          warnings.push(
            `Durée demandée (${briefSpec.targetDurationSec}s) supérieure au contenu réellement exploitable détecté dans les rushs — le montage utilisera tout le contenu disponible plutôt que d'inventer des images.`
          );
        }
      }
    });

    let creativePlan: CreativePlan | undefined;
    let storyBlueprint!: StoryBlueprint;
    // Le brief éditorial : identique au brief, mais avec la DURÉE décidée
    // par le directeur (dérivée du contenu si non demandée — jamais 45s).
    // C'est cette durée que consomment Story Director et Editor.
    let editorialBrief: BriefSpec = briefSpec;
    await runStage("story_blueprint", async () => {
      // LE DIRECTEUR CRÉATIF pilote le montage : il produit un plan unifié
      // (intention, MEILLEURE ACCROCHE choisie sur l'ensemble des plans,
      // durée éditoriale, arc narratif, pacing, courbe émotionnelle, cibles
      // qualité) que le Story Director consomme ensuite. 100% additif : si
      // le cerveau échoue, on retombe intégralement sur les heuristiques.
      try {
        creativePlan = await runCreativeBrain(
          db,
          router,
          input.projectId,
          allSegments,
          briefSpec,
          styleProfile,
          input.referenceVideoPaths
        );
        editorialBrief = { ...briefSpec, targetDurationSec: creativePlan.targetDurationSec };
        console.log(`[pipeline] Directeur créatif → durée ${creativePlan.targetDurationSec}s · ${creativePlan.reasoning}`);
      } catch (err) {
        warnings.push(`Directeur créatif indisponible, montage heuristique: ${(err as Error).message}`);
      }
      storyBlueprint = await runStoryDirector(db, router, input.projectId, allSegments, editorialBrief, styleProfile, 1, creativePlan);
    });

    const segmentsById = new Map(allSegments.map((s) => [s.id, s]));
    let editBlueprint!: EditBlueprint;
    await runStage("edit_blueprint", async () => {
      editBlueprint = runEditor(db, input.projectId, storyBlueprint, segmentsById, styleProfile, editorialBrief, 1);
    });

    await runStage("broll", async () => {
      editBlueprint = runBrollDirector(db, editBlueprint);
    });

    await runStage("captions", async () => {
      // Propage les VRAIS timestamps mot-à-mot (STT) → sous-titres
      // réellement synchronisés quand une clé Deepgram est configurée ;
      // repli uniforme honnête sinon.
      editBlueprint = runCaptionDirector(editBlueprint, segmentsById, styleProfile, transcripts);
    });

    let musicFilePath: string | null = null;
    await runStage("sound", async () => {
      const result = runSoundDesigner(db, editBlueprint, styleProfile);
      editBlueprint = result.editBlueprint;
      musicFilePath = result.musicFilePath;
    });

    let creativeReview!: CreativeReview;
    await runStage("creative_review", async () => {
      creativeReview = runCreativeDirector(editBlueprint, styleProfile, editorialBrief);
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
      // Progression RÉELLE du rendu (frames Remotion) + heartbeat : l'UI
      // voit "Export final — 88% → 100%" avancer, jamais un pourcentage figé.
      const band = stageBand(kind === "final" ? "final_render" : "proxy_render");
      const label = kind === "final" ? "Export final" : "Rendu d'aperçu";
      const onRenderProgress = ({ renderedFrames, totalFrames, concurrency }: { renderedFrames: number; totalFrames: number; concurrency: number }) => {
        if (!jobId || totalFrames <= 0) return;
        const frac = Math.max(0, Math.min(1, renderedFrames / totalFrames));
        const pct = Math.round(frac * 100);
        const elapsed = Date.now() - start;
        const eta = frac > 0.02 && frac < 1 ? Math.round((elapsed * (1 - frac)) / frac) : null;
        db.updateRenderJobProgress(jobId, {
          progress: Math.round(band.start + (band.end - band.start) * frac),
          currentStage: `${label} — ${pct}% (${renderedFrames}/${totalFrames} frames, ${concurrency} en parallèle)`,
          estimatedRemainingMs: eta,
          workerPid: process.pid,
        });
      };
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
          onRenderProgress,
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

      // LE DIRECTEUR ÉVALUE SON PROPRE MONTAGE : le Critic note le rendu
      // proxy contre le plan créatif (9 dimensions) et remonte ses
      // reproches. Additif — n'altère pas la décision QC déterministe
      // existante, mais donne au directeur un regard critique traçable.
      if (creativePlan) {
        try {
          const critique = await runCreativeCritic(db, input.projectId, proxyRender.id, editBlueprint, creativePlan, segmentsById);
          console.log(
            `[pipeline] Critique créatif → global ${critique.overallScore}/100 (créatif ${critique.creativeScore}, technique ${critique.technicalScore}) — ${critique.shouldIterate ? "itération recommandée" : "acceptable"}`
          );
          for (const issue of critique.criticalIssues) warnings.push(`[critic] ${issue.issue} → ${issue.suggestedAction}`);
        } catch (err) {
          warnings.push(`Critique créatif indisponible: ${(err as Error).message}`);
        }
      }
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

    const editorialSummary = buildEditorialSummary(
      editBlueprint,
      storyBlueprint,
      segmentsById,
      allSegments.length,
      creativePlan,
      briefSpec.targetDurationSec != null
    );
    console.log(`[pipeline] ─── RÉSUMÉ ÉDITORIAL ───`);
    for (const line of editorialSummary) console.log(`[pipeline] ${line}`);

    return { finalRender, proxyRender, qcReport, editBlueprint, briefSpec, styleProfile, warnings, editorialSummary };
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

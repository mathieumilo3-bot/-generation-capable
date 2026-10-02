/**
 * Script de validation bout-en-bout (§21 étape 1 à 18, §17-18 du brief
 * produit). Génère des rushs synthétiques via ffmpeg (aucune dépendance
 * à un fichier externe), seed une mini bibliothèque stock, lance le
 * pipeline complet, puis imprime un rapport honnête : progression réelle
 * par étape, coût réel (cost_ledger), scorecard QC, avertissements.
 *
 * Ce script tourne sans AUCUNE clé API — c'est le point : il prouve que
 * la chaîne complète produit un vrai fichier vidéo aujourd'hui, en mode
 * démo honnête (cf. précédent gc-ai-os). Avec des clés STT/LLM/vision
 * configurées, les mêmes agents basculent automatiquement sur leur
 * chemin réel sans changer une ligne de ce script.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Db } from "@video-editor/db";
import { ModelRouter } from "@video-editor/model-router";
import { probe, resolveStorageRoot } from "@video-editor/render";
import { projectCostSummary, COST_TARGETS_USD } from "@video-editor/cost-ledger";
import { runPipeline } from "./run-pipeline.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

async function ffmpeg(args: string[]): Promise<void> {
  await execFileAsync("ffmpeg", ["-hide_banner", "-y", ...args], { maxBuffer: 1024 * 1024 * 64 });
}

async function generateSyntheticRush(outputPath: string, opts: { durationSec: number; audioFilter: string; label: string }): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await ffmpeg([
    "-f",
    "lavfi",
    "-i",
    `testsrc2=size=1280x720:rate=30:duration=${opts.durationSec}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:duration=${opts.durationSec},${opts.audioFilter}`,
    "-vf",
    `drawtext=text='${opts.label}':fontcolor=white:fontsize=48:x=40:y=40`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    outputPath,
  ]);
}

async function generateStockClip(outputPath: string, color: string, durationSec: number): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await ffmpeg([
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:size=640x360:duration=${durationSec}:rate=30`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    outputPath,
  ]);
}

async function generateStockMusic(outputPath: string, frequency: number, durationSec: number): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await ffmpeg(["-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${durationSec}`, "-c:a", "aac", outputPath]);
}

async function main(): Promise<void> {
  const repoRoot = join(__dirname, "..", "..", "..");
  process.env.VIDEO_EDITOR_STORAGE_ROOT = process.env.VIDEO_EDITOR_STORAGE_ROOT ?? join(repoRoot, "storage");
  const storageRoot = resolveStorageRoot();
  console.log(`Racine de stockage : ${storageRoot}`);

  const dbPath = join(storageRoot, "demo.sqlite");
  const db = new Db(dbPath);
  const router = new ModelRouter();
  console.log("Capacités du Model Router :", router.capabilities);
  if (!router.capabilities.llm && !router.capabilities.vision && !router.capabilities.stt) {
    console.log(
      "Aucune clé API configurée (ANTHROPIC_API_KEY / GOOGLE_API_KEY / DEEPGRAM_API_KEY) — le pipeline tourne entièrement sur ses replis déterministes. C'est un test valide du squelette, pas une démonstration de la qualité éditoriale visée en production."
    );
  }

  const project = db.createProject({ userId: "demo-user", title: "Démo pipeline bout-en-bout" });
  console.log(`Projet créé : ${project.id}`);

  // --- Rushs synthétiques : silences réels + niveaux d'énergie distincts, pour donner à l'Agent 02 quelque chose de non trivial à scorer.
  const rush1Path = join(storageRoot, project.id, "rushes", "rush1.mp4");
  await generateSyntheticRush(rush1Path, {
    durationSec: 40,
    label: "RUSH 1",
    audioFilter: [
      "volume=enable='between(t,0,1)':volume=0",
      "volume=enable='between(t,1,9)':volume=0.25",
      "volume=enable='between(t,9,10)':volume=0",
      "volume=enable='between(t,10,19)':volume=0.9",
      "volume=enable='between(t,19,20)':volume=0",
      "volume=enable='between(t,20,29)':volume=0.5",
      "volume=enable='between(t,29,30)':volume=0",
      "volume=enable='between(t,30,39)':volume=0.85",
      "volume=enable='between(t,39,40)':volume=0",
    ].join(","),
  });
  const rush2Path = join(storageRoot, project.id, "rushes", "rush2.mp4");
  await generateSyntheticRush(rush2Path, {
    durationSec: 15,
    label: "RUSH 2",
    audioFilter: [
      "volume=enable='between(t,0,1)':volume=0",
      "volume=enable='between(t,1,7)':volume=0.8",
      "volume=enable='between(t,7,8)':volume=0",
      "volume=enable='between(t,8,14)':volume=0.4",
      "volume=enable='between(t,14,15)':volume=0",
    ].join(","),
  });

  for (const rushPath of [rush1Path, rush2Path]) {
    const info = await probe(rushPath);
    db.createRush({
      projectId: project.id,
      originalFilename: rushPath.split("/").pop()!,
      storagePath: rushPath,
      container: "mp4",
      codec: info.videoCodec === "h264" ? "h264" : "unknown",
      durationSec: info.durationSec,
      hasAudio: info.hasAudio,
    });
  }
  console.log(`${2} rushs ingérés, durée totale ${(40 + 15).toFixed(0)}s.`);

  // --- Mini bibliothèque stock (placeholder — pas un vrai catalogue licencié, uniquement pour exercer les Agents 05/07 dans ce test).
  const stockDir = join(storageRoot, "stock");
  const brollA = join(stockDir, "broll_bureau.mp4");
  const brollB = join(stockDir, "broll_concept.mp4");
  await generateStockClip(brollA, "gray", 3);
  await generateStockClip(brollB, "navy", 3);
  db.insertMedia({ kind: "stock", projectId: null, storagePath: brollA, tags: ["development", "context", "b-roll"] });
  db.insertMedia({ kind: "stock", projectId: null, storagePath: brollB, tags: ["proof", "tension", "conclusion", "b-roll"] });

  const musicEnergetic = join(stockDir, "music_energetic.m4a");
  const musicCalm = join(stockDir, "music_calm.m4a");
  await generateStockMusic(musicEnergetic, 220, 60);
  await generateStockMusic(musicCalm, 110, 60);
  db.insertMedia({ kind: "stock", projectId: null, storagePath: musicEnergetic, tags: ["energetic"] });
  db.insertMedia({ kind: "stock", projectId: null, storagePath: musicCalm, tags: ["calm"] });
  console.log("Bibliothèque stock de démonstration seedée (placeholder — pas un catalogue licencié réel).");

  const brief =
    "Fais-moi une vidéo TikTok de 45 secondes, très dynamique, avec un hook fort, des sous-titres, des zooms et du B-roll. Destinée aux entrepreneurs.";

  console.log("\n--- Lancement du pipeline ---");
  const timings: Record<string, number> = {};
  const starts: Record<string, number> = {};
  const t0 = Date.now();
  const result = await runPipeline(
    db,
    router,
    { projectId: project.id, rawBriefText: brief, presetId: "preset_dynamic_social" },
    (stage, status) => {
      if (status === "start") {
        starts[stage] = Date.now();
        console.log(`  → ${stage}…`);
      } else {
        const ms = Date.now() - (starts[stage] ?? Date.now());
        timings[stage] = ms;
        console.log(`  ${status === "done" ? "✓" : "✗"} ${stage} (${ms}ms)`);
      }
    }
  );
  const totalMs = Date.now() - t0;

  console.log("\n--- Rapport ---");
  console.log(`Durée totale pipeline : ${(totalMs / 1000).toFixed(1)}s`);
  console.log("Temps par étape (ms):", timings);
  console.log(`\nBrief interprété (${router.capabilities.llm ? "LLM réel" : "heuristique"}):`, result.briefSpec);
  console.log(`Style profile utilisé : ${result.styleProfile.name} (${result.styleProfile.source})`);
  console.log(`\nEditBlueprint : ${result.editBlueprint.clips.length} plans, ${result.editBlueprint.totalDurationSec.toFixed(1)}s, ${result.editBlueprint.captions.length} cues de sous-titres, ${result.editBlueprint.brollSlots.filter((s) => s.resolvedSource).length}/${result.editBlueprint.brollSlots.length} slots B-roll résolus, musique: ${result.editBlueprint.music?.title ?? "aucune"}.`);
  console.log("\nScorecard QC:");
  for (const [k, v] of Object.entries(result.qcReport.scores)) console.log(`  ${k.padEnd(12)} ${v}/100`);
  console.log(`QC passed: ${result.qcReport.passed} (seuil ${result.qcReport.threshold})`);
  if (result.qcReport.corrections.length > 0) console.log("Corrections proposées:", result.qcReport.corrections);

  const cost = projectCostSummary(db, project.id);
  console.log(`\nCoût mesuré (cost_ledger) : ${cost.totalUsd.toFixed(4)} $ sur ${cost.entryCount} appels — 100% stub: ${cost.isFullyStub}`);
  console.log("Détail par agent (micro-USD):", cost.byAgent);
  console.log(`Cibles de conception (§10 du brief) — MVP < ${COST_TARGETS_USD.mvp}$, optimisé ~${COST_TARGETS_USD.optimized}$, long terme < ${COST_TARGETS_USD.longTerm}$.`);
  if (cost.isFullyStub) {
    console.log(
      "Aucun coût réel engagé dans cette exécution (aucune clé API) — cette mesure valide seulement que le pipeline ne dépend d'aucun appel payant pour tourner. Le coût réel sera mesurable via ce même cost_ledger dès qu'une clé sera configurée."
    );
  }

  if (result.warnings.length > 0) {
    console.log("\nAvertissements:");
    for (const w of result.warnings) console.log(`  - ${w}`);
  }

  const finalInfo = await probe(result.finalRender.filePath!);
  console.log(`\nRendu final : ${result.finalRender.filePath}`);
  console.log(`  ${finalInfo.width}x${finalInfo.height}, ${finalInfo.durationSec.toFixed(1)}s, codec ${finalInfo.videoCodec}`);

  db.close();
}

main().catch((err) => {
  console.error("ÉCHEC du pipeline de démonstration:", err);
  process.exit(1);
});

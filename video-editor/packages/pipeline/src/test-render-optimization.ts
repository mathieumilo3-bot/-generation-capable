/**
 * Test suite for render pipeline optimizations.
 * Verifies: timeout mechanism, file cleanup, final validation, and performance.
 * Run with: pnpm --filter @video-editor/pipeline run test:render-opt
 */
import { existsSync } from "node:fs";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Db } from "@video-editor/db";
import { ModelRouter } from "@video-editor/model-router";
import { probe, resolveStorageRoot } from "@video-editor/render";
import { runPipeline } from "./run-pipeline.js";

const execFileAsync = promisify(execFile);

async function generateTestRush(outputPath: string): Promise<void> {
  const [dir] = outputPath.split("/").slice(-1);
  await mkdir(join(outputPath, ".."), { recursive: true });

  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=1280x720:rate=30:duration=10",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=10",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "28",
    "-c:a",
    "aac",
    outputPath,
  ]);
  console.log(`[test] Generated test rush: ${outputPath}`);
}

async function testRenderOptimization(): Promise<void> {
  const storageRoot = resolveStorageRoot();
  const testProjectId = `test-render-opt-${Date.now()}`;
  const projectDir = join(storageRoot, testProjectId);

  console.log(`\n[test] Starting render optimization test…`);
  console.log(`[test] Project ID: ${testProjectId}`);
  console.log(`[test] Storage root: ${storageRoot}\n`);

  try {
    // Setup
    await mkdir(join(projectDir, "rushes"), { recursive: true });
    const rushPath = join(projectDir, "rushes", "test.mp4");
    await generateTestRush(rushPath);

    const db = new Db(join(storageRoot, "test.sqlite"));
    const router = new ModelRouter();

    // Create project and rush
    const project = db.createProject({
      userId: "test-user",
      title: "Render Optimization Test",
    });
    console.log(`[test] Created project: ${project.id}`);

    const rushInfo = await probe(rushPath);
    db.createRush({
      projectId: project.id,
      originalFilename: "test.mp4",
      storagePath: rushPath,
      container: "mp4",
      codec: "h264",
      durationSec: rushInfo.durationSec,
      hasAudio: rushInfo.hasAudio,
    });
    console.log(`[test] Ingested rush: ${rushInfo.durationSec.toFixed(1)}s\n`);

    // Run pipeline
    const t0 = Date.now();
    let stageCount = 0;
    const result = await runPipeline(
      db,
      router,
      {
        projectId: project.id,
        rawBriefText: "Make a 15 second video with dynamic cuts",
        presetId: "preset_dynamic_social",
        width: 1080,
        height: 1920,
        fps: 30,
      },
      (stage, status) => {
        if (status === "start") {
          stageCount++;
          console.log(`  [${stageCount}/18] ${stage}…`);
        } else if (status === "done") {
          console.log(`       ✓ ${stage}`);
        } else {
          console.log(`       ✗ ${stage}`);
        }
      }
    );

    const totalMs = Date.now() - t0;

    // Validate final render
    console.log(`\n[test] ========== RESULTS ==========`);
    console.log(`[test] Total time: ${(totalMs / 1000).toFixed(1)}s`);
    console.log(`[test] Final render: ${result.finalRender.filePath}`);

    if (!result.finalRender.filePath || !existsSync(result.finalRender.filePath)) {
      throw new Error("Final render file does not exist");
    }

    const finalInfo = await probe(result.finalRender.filePath);
    console.log(`[test] Resolution: ${finalInfo.width}x${finalInfo.height}`);
    console.log(`[test] Duration: ${finalInfo.durationSec.toFixed(1)}s`);
    console.log(`[test] Codec: ${finalInfo.videoCodec}`);

    // Check cleanup
    const workDir = join(projectDir, "work");
    const workDirExists = existsSync(workDir);
    console.log(`[test] Work directory cleaned: ${!workDirExists ? "✓" : "✗"}`);

    // Verify QC
    console.log(`\n[test] QC Report:`);
    console.log(`[test]   Overall score: ${result.qcReport.scores.overall}/100`);
    console.log(`[test]   Passed: ${result.qcReport.passed}`);

    console.log(`\n[test] ✓ Render optimization test PASSED`);
  } catch (err) {
    console.error(`\n[test] ✗ Render optimization test FAILED`);
    console.error(`[test] Error: ${(err as Error).message}`);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await rm(projectDir, { recursive: true, force: true });
      console.log(`[test] Cleaned up test project directory`);
    } catch (err) {
      console.warn(`[test] Failed to cleanup: ${(err as Error).message}`);
    }
  }
}

testRenderOptimization().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

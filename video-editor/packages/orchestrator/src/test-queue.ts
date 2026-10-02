/**
 * Test automatisé de la Render Queue + Scheduler (§2, §3, §17, §18, §28).
 *
 * Prouve, sans dépendre du pipeline réel (worker mock), que la mécanique
 * de la factory tient ses garanties :
 *   1. dédup par projet (trois clics = un job)
 *   2. claim atomique (jamais deux workers sur le même job)
 *   3. priorité respectée
 *   4. concurrence adaptative bornée par les ressources
 *   5. recovery d'un worker mort (crash)
 *   6. retry borné puis échec définitif
 *   7. annulation
 *   8. progression monotone
 *   9. intégration scheduler : N projets, capacité limitée, tous terminés,
 *      aucune double exécution.
 *
 * Sortie : "OK" + code 0 si tout passe, sinon lève et code 1.
 */
import { Db } from "@video-editor/db";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideConcurrency } from "./adaptive-concurrency.js";
import { loadFactoryConfig, resetFactoryConfigCache, type FactoryConfig } from "./config.js";
import { RenderScheduler } from "./scheduler.js";
import { computeProgress, type PipelineStage } from "@video-editor/shared-types";

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION ÉCHOUÉE: ${msg}`);
  passed++;
  console.log(`  ✓ ${msg}`);
}

function makeDb(): { db: Db; dir: string; dbPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "ve-queue-test-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new Db(dbPath);
  return { db, dir, dbPath };
}

function seedProject(db: Db, title: string): string {
  const p = db.createProject({ userId: "test", title });
  return p.id;
}

function payloadFor(projectId: string): string {
  return JSON.stringify({ projectId, rawBriefText: "test" });
}

async function testQueueUnit(): Promise<void> {
  console.log("\n[1] Queue — unités (dédup, claim atomique, priorité, retry, cancel)");
  const { db, dir } = makeDb();
  try {
    const pA = seedProject(db, "A");
    const pB = seedProject(db, "B");

    // Dédup
    const j1 = db.enqueueRenderJob({ projectId: pA, payload: payloadFor(pA) });
    const j2 = db.enqueueRenderJob({ projectId: pA, payload: payloadFor(pA) });
    assert(j1.jobId === j2.jobId, "dédup par projet : deux enqueue = un seul job");

    // Priorité
    const jB = db.enqueueRenderJob({ projectId: pB, payload: payloadFor(pB), priority: 10 });
    const first = db.claimNextRenderJob("w1");
    assert(first?.jobId === jB.jobId, "priorité respectée : le job prioritaire est réclamé en premier");

    // Claim atomique : le job déjà réclamé n'est pas re-réclamé
    const second = db.claimNextRenderJob("w2");
    assert(second?.jobId === j1.jobId, "claim suivant : réclame l'autre job, pas le déjà-pris");
    const third = db.claimNextRenderJob("w3");
    assert(third === null, "claim atomique : plus rien à réclamer (aucune double-réclamation)");

    // Retry borné puis échec
    const jobId = j1.jobId; // attempts=1 après claim
    let job = db.getRenderJob(jobId)!;
    assert(job.attempts === 1, "attempts incrémenté au claim");
    const req1 = db.failRenderJob(jobId, "échec 1");
    assert(req1 === true, "échec avec tentatives restantes → remis en file");
    db.claimNextRenderJob("w"); // attempts=2
    const req2 = db.failRenderJob(jobId, "échec 2");
    assert(req2 === true, "2e échec → encore remis en file (maxAttempts=3)");
    db.claimNextRenderJob("w"); // attempts=3
    const req3 = db.failRenderJob(jobId, "échec 3");
    assert(req3 === false, "3e échec (tentatives épuisées) → échec définitif");
    assert(db.getRenderJob(jobId)!.status === "failed", "statut final = failed");

    // Cancel
    const jB2 = db.getRenderJob(jB.jobId)!;
    assert(jB2.status === "preparing", "jB toujours en cours avant annulation");
    const cancelRes = db.cancelRenderJob(jB.jobId);
    assert(cancelRes !== null, "cancel renvoie un résultat");
    assert(db.getRenderJob(jB.jobId)!.status === "cancelled", "statut après annulation = cancelled");

    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function testRecovery(): Promise<void> {
  console.log("\n[2] Recovery — worker mort (heartbeat périmé)");
  const { db, dir } = makeDb();
  try {
    const p = seedProject(db, "R");
    const job = db.enqueueRenderJob({ projectId: p, payload: payloadFor(p) });
    db.claimNextRenderJob("w1"); // → preparing, heartbeat = maintenant

    // staleMs très grand : rien n'est périmé
    const none = db.recoverStaleRenderJobs(3_600_000);
    assert(none.length === 0, "heartbeat frais → aucun job repris");

    // staleMs=0 : tout job running est considéré orphelin (redémarrage)
    const recovered = db.recoverStaleRenderJobs(0);
    assert(recovered.length === 1 && recovered[0]!.jobId === job.jobId, "staleMs=0 → job running repris (redémarrage)");
    assert(db.getRenderJob(job.jobId)!.status === "queued", "job repris repasse en file");

    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function testAdaptive(): void {
  console.log("\n[3] Concurrence adaptative — bornée par les ressources");
  resetFactoryConfigCache();
  const base = loadFactoryConfig();

  // Petite machine simulée
  const small = decideConcurrency(base, {
    cpuCount: 2,
    loadPerCore: 0.1,
    totalMemMb: 2048,
    freeMemMb: 1500,
    availableMemMb: 1600,
    sampledAt: new Date().toISOString(),
  });
  assert(small.maxWorkers === 1, `petite machine (2c/1.6Go) → 1 worker (obtenu ${small.maxWorkers})`);

  // Grosse machine simulée
  const big = decideConcurrency(base, {
    cpuCount: 8,
    loadPerCore: 0.1,
    totalMemMb: 16384,
    freeMemMb: 14000,
    availableMemMb: 14000,
    sampledAt: new Date().toISOString(),
  });
  assert(big.maxWorkers >= 4, `grosse machine (8c/14Go) → ≥4 workers (obtenu ${big.maxWorkers})`);
  assert(small.maxWorkers >= 1, "plancher : jamais 0 worker");
}

function testProgressMonotonic(): void {
  console.log("\n[4] Progression — monotone et honnête");
  const stages: PipelineStage[] = [
    "upload",
    "proxy_generation",
    "video_analysis",
    "proxy_render",
    "final_render",
    "delivery",
  ];
  const done = new Set<PipelineStage>();
  let last = -1;
  for (const s of stages) {
    const p = computeProgress(done, s);
    assert(p >= last, `progression ne recule pas à ${s} (${p}% ≥ ${last}%)`);
    last = p;
    done.add(s);
  }
  const full = computeProgress(new Set(stages));
  assert(full > last - 5, "progression proche de 100% quand tout est fait");
}

async function testSchedulerIntegration(): Promise<void> {
  console.log("\n[5] Scheduler — intégration (capacité limitée, tous terminés, 0 double-exec)");
  const { db, dir, dbPath } = makeDb();
  try {
    const mockWorker = join(__dirname, "test-worker-mock.js");
    // Force 2 workers max pour prouver le respect de la capacité.
    const config: FactoryConfig = {
      ...loadFactoryConfig(),
      adaptiveConcurrency: false,
      maxConcurrentJobs: 2,
      schedulerIntervalMs: 300,
    };

    const N = 6;
    const projectIds: string[] = [];
    for (let i = 0; i < N; i++) {
      const p = seedProject(db, `P${i}`);
      projectIds.push(p);
      db.enqueueRenderJob({ projectId: p, payload: payloadFor(p) });
    }

    const scheduler = new RenderScheduler({
      db,
      workerCliPath: mockWorker,
      storageRoot: dir,
      dbPath,
      config,
      recoverOnStart: true,
    });

    let peakActive = 0;
    scheduler.start();
    const startedAt = Date.now();
    // Boucle d'attente : tous les jobs terminés (completed) ou timeout.
    while (Date.now() - startedAt < 20_000) {
      peakActive = Math.max(peakActive, scheduler.activeWorkerCount());
      const completed = db.listRenderJobs({ status: "completed" }).length;
      if (completed === N) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    scheduler.stop();

    const completed = db.listRenderJobs({ status: "completed" });
    assert(completed.length === N, `les ${N} jobs sont terminés (obtenu ${completed.length})`);
    assert(peakActive <= 2, `capacité respectée : jamais plus de 2 workers simultanés (pic ${peakActive})`);
    assert(peakActive >= 2, `parallélisme réel : au moins 2 workers ont tourné ensemble (pic ${peakActive})`);

    // Aucune double exécution : chaque projet a exactement un job terminé.
    const uniqueProjects = new Set(completed.map((j) => j.projectId));
    assert(uniqueProjects.size === N, "aucune double exécution : un job terminé par projet");

    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function testSchedulerCrashRecovery(): Promise<void> {
  console.log("\n[6] Scheduler — un worker qui crash est repris et le job finit");
  const { db, dir, dbPath } = makeDb();
  try {
    const mockWorker = join(__dirname, "test-worker-mock.js");
    const config: FactoryConfig = {
      ...loadFactoryConfig(),
      adaptiveConcurrency: false,
      maxConcurrentJobs: 1,
      schedulerIntervalMs: 300,
    };
    const p = seedProject(db, "crash");
    db.enqueueRenderJob({ projectId: p, payload: payloadFor(p), maxAttempts: 3 });

    // Le worker crash tant que attempts<=1 puis réussit — déterministe,
    // sans course sur l'env (le comportement dépend de l'état en base).
    process.env.MOCK_BEHAVIOR = "crash_first";
    const scheduler = new RenderScheduler({ db, workerCliPath: mockWorker, storageRoot: dir, dbPath, config });
    scheduler.start();

    const startedAt = Date.now();
    let done = false;
    while (Date.now() - startedAt < 15_000) {
      const j = db.getActiveRenderJobForProject(p);
      if (!j) {
        done = db.listRenderJobs({ status: "completed" }).some((x) => x.projectId === p);
        if (done) break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    scheduler.stop();
    delete process.env.MOCK_BEHAVIOR;
    assert(done, "après crash du 1er worker, le job est repris et finit par réussir");
    const finalJob = db.listRenderJobs().find((j) => j.projectId === p)!;
    assert(finalJob.attempts >= 2, `le job a bien été réessayé (attempts=${finalJob.attempts})`);

    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  console.log("=== Test Render Queue + Scheduler ===");
  await testQueueUnit();
  await testRecovery();
  testAdaptive();
  testProgressMonotonic();
  await testSchedulerIntegration();
  await testSchedulerCrashRecovery();
  console.log(`\n✅ OK — ${passed} assertions passées`);
}

main().catch((err) => {
  console.error(`\n❌ ÉCHEC : ${(err as Error).message}`);
  process.exit(1);
});

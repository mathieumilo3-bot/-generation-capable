/**
 * Test de la POLITIQUE DE DURÉE + décisions éditoriales (§3, §24, §20).
 *
 * Prouve, en logique pure (aucun ffmpeg, aucune clé) :
 *   TEST 1  brief sans durée → AUCUN 45s (targetDurationSec undefined).
 *   TEST 2  contenu 12s + brief dynamique → cible ≈ contenu, jamais 45.
 *   TEST 3  durée explicite > contenu → ramenée au contenu (pas de remplissage).
 *   TEST 4  contenu long + short-form → plafonné (≤ 60s).
 *   TEST 9  durée courte demandée → segments réellement RETIRÉS du montage
 *           (discardés absents du blueprint = absents du MP4).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Db } from "@video-editor/db";
import { ModelRouter } from "@video-editor/model-router";
import { runBriefAnalyzer, runStoryDirector, runEditor, resolveTargetDurationSec } from "@video-editor/agents";
import { BUILT_IN_STYLE_PROFILES, type Segment } from "@video-editor/shared-types";

let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION ÉCHOUÉE: ${msg}`);
  passed++;
  console.log(`  ✓ ${msg}`);
}

function seg(id: string, start: number, durSec = 3, energy = 0.6): Segment {
  return {
    id, rushId: "r1", projectId: "p1", start, end: start + durSec,
    transcript: `phrase ${id}`, energy, clarity: 0.7, relevance: 0.6,
    hookPotential: 0.6, visualQuality: 0.8, narrativeInterest: 0.6,
  };
}

async function main(): Promise<void> {
  console.log("=== Test politique de durée ===");
  const dir = mkdtempSync(join(tmpdir(), "ve-dur-test-"));
  const db = new Db(join(dir, "t.sqlite"));
  // Projet réel pour satisfaire les FK des enregistrements de coût.
  const realProject = db.createProject({ userId: "t", title: "dur" });
  const router = new ModelRouter(); // aucune clé → chemin heuristique
  const style = BUILT_IN_STYLE_PROFILES.find((p) => p.id === "preset_dynamic_social")!;

  try {
    console.log("\n[TEST 1] Brief SANS durée → aucun 45s");
    const spec = await runBriefAnalyzer(db, router, realProject.id, "Fais-moi un montage dynamique et professionnel");
    console.log(`  targetDurationSec = ${spec.targetDurationSec}`);
    assert(spec.targetDurationSec === undefined, "aucune durée déduite (pas de 45s inventé)");

    console.log("\n[TEST 1b] Brief AVEC durée explicite → respectée");
    const spec30 = await runBriefAnalyzer(db, router, realProject.id, "Monte-moi une vidéo de 30 secondes");
    assert(spec30.targetDurationSec === 30, `durée explicite 30s respectée (obtenu ${spec30.targetDurationSec})`);

    console.log("\n[TEST 2] Contenu 12s + brief sans durée → cible ≈ contenu (pas 45)");
    const segs12 = [seg("s1", 0), seg("s2", 3), seg("s3", 6), seg("s4", 9)]; // 4×3 = 12s
    const d = resolveTargetDurationSec({ platform: "tiktok", targetDurationSec: undefined }, segs12);
    console.log(`  → ${d.targetSec}s (${d.reason})`);
    assert(d.targetSec <= 12.1 && d.targetSec >= 8, `cible ${d.targetSec}s ≈ contenu 12s, jamais 45`);
    assert(d.explicit === false, "marquée comme dérivée");

    console.log("\n[TEST 3] Durée explicite 30s mais contenu 12s → ramenée à 12s (pas de remplissage)");
    const d3 = resolveTargetDurationSec({ platform: "tiktok", targetDurationSec: 30 }, segs12);
    console.log(`  → ${d3.targetSec}s (${d3.reason})`);
    assert(d3.targetSec <= 12.1, `ramenée au contenu (${d3.targetSec}s), on ne fabrique pas 30s`);

    console.log("\n[TEST 4] Contenu long (120s) + short-form → plafonné à 60s");
    const segsLong = Array.from({ length: 40 }, (_, i) => seg(`L${i}`, i * 3)); // 40×3 = 120s
    const d4 = resolveTargetDurationSec({ platform: "tiktok", targetDurationSec: undefined }, segsLong);
    console.log(`  → ${d4.targetSec}s (${d4.reason})`);
    assert(d4.targetSec <= 60, `plafonné short-form (${d4.targetSec}s ≤ 60)`);

    console.log("\n[TEST 9] Durée courte demandée → segments réellement retirés du montage");
    const segs24 = Array.from({ length: 8 }, (_, i) => seg(`k${i}`, i * 3, 3, 0.5 + i * 0.05)); // 24s, scores variés
    const briefShort = { ...spec, platform: "tiktok" as const, targetDurationSec: 6 }; // 6s demandées sur 24s
    const story = await runStoryDirector(db, router, realProject.id, segs24, briefShort, style, 1);
    const usedIds = new Set(story.beats.flatMap((b) => b.segmentIds));
    console.log(`  retenus ${usedIds.size}/${segs24.length}, discardés ${story.discardedSegmentIds.length}`);
    assert(story.discardedSegmentIds.length > 0, "des segments sont RÉELLEMENT retirés quand 6s demandées sur 24s");

    // Le montage exécuté ne contient QUE les segments retenus (removal visible dans le blueprint → MP4).
    const segMap = new Map(segs24.map((s) => [s.id, s]));
    const edit = runEditor(db, realProject.id, story, segMap, style, briefShort, 1);
    const clipSegIds = new Set(edit.clips.map((c) => c.segmentId));
    const leaked = [...clipSegIds].filter((id) => story.discardedSegmentIds.includes(id));
    assert(leaked.length === 0, "aucun segment retiré ne réapparaît dans la timeline montée");
    assert(edit.totalDurationSec <= 12, `durée montée (${edit.totalDurationSec.toFixed(1)}s) cohérente avec la demande courte, jamais 45s`);

    console.log(`\n✅ OK — ${passed} assertions passées`);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`\n❌ ÉCHEC : ${(err as Error).message}`);
  process.exit(1);
});

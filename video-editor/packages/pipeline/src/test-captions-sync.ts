/**
 * Test des sous-titres synchronisés mot-à-mot (Agent 06).
 *
 * Prouve, en logique pure (aucun ffmpeg, aucune clé), que le Caption
 * Director :
 *   1. utilise les VRAIS timestamps mot-à-mot quand ils sont fournis (STT)
 *      → un mot apparaît exactement quand il est prononcé, pas à une
 *      position uniforme ;
 *   2. retombe proprement sur une répartition uniforme sinon ;
 *   3. mappe correctement le temps source → temps timeline (offset du clip).
 */
import { runCaptionDirector } from "@video-editor/agents";
import { BUILT_IN_STYLE_PROFILES, type EditBlueprint, type Segment } from "@video-editor/shared-types";

let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION ÉCHOUÉE: ${msg}`);
  passed++;
  console.log(`  ✓ ${msg}`);
}
function approx(a: number, b: number, tol = 0.06): boolean {
  return Math.abs(a - b) <= tol;
}

function findWord(blueprint: EditBlueprint, word: string): { start: number; end: number } | null {
  for (const cue of blueprint.captions) {
    for (const w of cue.words) if (w.word === word) return { start: w.start, end: w.end };
  }
  return null;
}

function main(): void {
  console.log("=== Test sous-titres synchronisés ===");
  const style = BUILT_IN_STYLE_PROFILES.find((p) => p.id === "preset_dynamic_social")!;

  // Un clip : source [10s,13s] placé au début de la timeline (offset -10s).
  const clip = {
    id: "clip1", segmentId: "s1", rushId: "r1",
    sourceStart: 10, sourceEnd: 13, timelineStart: 0, outDuration: 3,
    zoomKeyframes: [], transitionIn: "hard_cut", role: "hook",
  };
  const blueprint = { id: "e1", projectId: "p1", clips: [clip], captions: [] } as unknown as EditBlueprint;
  const segment: Segment = {
    id: "s1", rushId: "r1", projectId: "p1", start: 10, end: 13,
    transcript: "alpha beta gamma", energy: 0.6, clarity: 0.7, relevance: 0.6,
    hookPotential: 0.6, visualQuality: 0.8, narrativeInterest: 0.6,
  };
  const segById = new Map([["s1", segment]]);

  console.log("\n[1] Avec timestamps STT réels (beta prononcé tard dans le clip)");
  // alpha tôt, beta DÉCALÉ à 11.5s (pas au tiers uniforme 11.0s), gamma à 12.6s.
  const transcripts = new Map([
    ["r1", { words: [
      { word: "alpha", start: 10.0, end: 10.4 },
      { word: "beta", start: 11.5, end: 11.9 },
      { word: "gamma", start: 12.6, end: 12.9 },
    ] }],
  ]);
  const synced = runCaptionDirector(blueprint, segById, style, transcripts);
  const betaSync = findWord(synced, "beta");
  const gammaSync = findWord(synced, "gamma");
  assert(synced.captions.length > 0, "des sous-titres sont produits");
  assert(betaSync !== null && approx(betaSync.start, 1.5), `"beta" apparaît à son temps réel ≈1.5s (obtenu ${betaSync?.start.toFixed(2)})`);
  assert(gammaSync !== null && approx(gammaSync.start, 2.6), `"gamma" apparaît à son temps réel ≈2.6s (obtenu ${gammaSync?.start.toFixed(2)})`);

  console.log("\n[2] Sans STT → repli uniforme (positions équi-réparties)");
  const uniform = runCaptionDirector(blueprint, segById, style);
  const betaUni = findWord(uniform, "beta");
  assert(uniform.captions.length > 0, "des sous-titres sont produits même sans STT");
  assert(betaUni !== null && approx(betaUni.start, 1.0), `"beta" est à la position uniforme ≈1.0s (obtenu ${betaUni?.start.toFixed(2)})`);

  console.log("\n[3] La synchro réelle diffère bien du repli uniforme");
  assert(betaSync !== null && betaUni !== null && Math.abs(betaSync.start - betaUni.start) > 0.3,
    `sync (${betaSync!.start.toFixed(2)}s) ≠ uniforme (${betaUni!.start.toFixed(2)}s) — les vrais timings sont réellement utilisés`);

  console.log(`\n✅ OK — ${passed} assertions passées`);
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ÉCHEC : ${(err as Error).message}`);
  process.exit(1);
}

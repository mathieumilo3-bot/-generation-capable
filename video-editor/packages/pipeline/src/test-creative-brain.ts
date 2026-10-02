/**
 * Test du DIRECTEUR CRÉATIF (creative-brain) — chemin LLM + replis.
 *
 * Le vrai appel Anthropic ne peut pas être exécuté ici (pas de clé), donc
 * on injecte un ModelRouter MOCKÉ dont le `llm.complete` renvoie une
 * direction canned. On prouve, sans rien simuler du code testé :
 *   1. quand le LLM répond, sa direction PILOTE le plan (accroche choisie
 *      par le directeur, hybride, isStub=false) ;
 *   2. une accroche HALLUCINÉE (id inexistant) est rejetée → repli
 *      heuristique complet ;
 *   3. sans capacité LLM, plan 100% heuristique.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Db } from "@video-editor/db";
import { runCreativeBrain } from "@video-editor/agents";
import { BUILT_IN_STYLE_PROFILES, type BriefSpec, type Segment } from "@video-editor/shared-types";
import type { ModelRouter } from "@video-editor/model-router";

let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION ÉCHOUÉE: ${msg}`);
  passed++;
  console.log(`  ✓ ${msg}`);
}

function seg(id: string, start: number, energy: number, hook: number): Segment {
  return {
    id, rushId: "r1", projectId: "p1", start, end: start + 3,
    transcript: `texte ${id}`, energy, clarity: 0.7, relevance: 0.6,
    hookPotential: hook, visualQuality: 0.8, narrativeInterest: 0.6,
  };
}

function mockRouter(llmComplete: ((p: unknown) => Promise<{ data: string }>) | null): ModelRouter {
  return {
    capabilities: { llm: llmComplete !== null, vision: false, stt: false, ttv: false },
    llm: {
      isReal: false,
      complete: async () => {
        const r = await llmComplete!({});
        return {
          data: r.data, provider: "anthropic", model: "mock", inputUnits: 1, inputUnitType: "tokens",
          outputUnits: 1, outputUnitType: "tokens", durationMs: 1, costMicroUsd: 0, isStub: false,
        };
      },
    },
  } as unknown as ModelRouter;
}

async function main(): Promise<void> {
  console.log("=== Test directeur créatif (creative-brain) ===");
  const dir = mkdtempSync(join(tmpdir(), "ve-brain-test-"));
  const db = new Db(join(dir, "t.sqlite"));
  const project = db.createProject({ userId: "t", title: "brain" });
  const style = BUILT_IN_STYLE_PROFILES.find((p) => p.id === "preset_dynamic_social")!;
  const brief: BriefSpec = {
    objective: "Inspirer les jeunes créateurs", audience: "16-25", platform: "tiktok",
    targetDurationSec: 30, tone: "énergique", style: "dynamique", dynamism: 0.7, constraints: [],
  };
  // s1 a le meilleur score heuristique (early + énergie), s3 est un plan « milieu ».
  const segments = [seg("s1", 0, 0.9, 0.9), seg("s2", 4, 0.6, 0.5), seg("s3", 8, 0.7, 0.6), seg("s4", 12, 0.5, 0.4)];

  try {
    console.log("\n[1] Le LLM désigne s3 → le directeur impose s3 comme accroche");
    const routerLlm = mockRouter(async () => ({
      data: JSON.stringify({
        intent: "inspiration", clarity: 0.9, bestHookSegmentId: "s3", hookType: "revelation",
        hookReasoning: "Le moment le plus fort émotionnellement", narrativeStructure: "hero_journey",
        overallTone: "inspirant", endingFeeling: "motivé", reasoning: "s3 crée la meilleure ouverture",
      }),
    }));
    const plan = await runCreativeBrain(db, routerLlm, project.id, segments, brief, style);
    assert(plan.bestHook.segmentId === "s3", `accroche = s3 imposée par le directeur (obtenu ${plan.bestHook.segmentId})`);
    assert(plan.bestHook.isStub === false, "l'accroche est marquée LLM (isStub=false)");
    assert(plan.bestHook.type === "revelation", "le type d'accroche vient du LLM (revelation)");
    assert(plan.narrativeArc.structure === "hero_journey", "la structure narrative vient du LLM (hero_journey)");
    assert(plan.contentIntent.primary === "inspiration", "l'intention vient du LLM (inspiration)");
    assert(plan.emotionalCurve.overallTone === "inspirant", "le ton vient du LLM");
    assert(plan.hybridApproach === true && plan.isFullyHeuristic === false, "plan marqué hybride LLM+heuristique");

    console.log("\n[2] Le LLM HALLUCINE une accroche (id inexistant) → repli heuristique");
    const routerHalluc = mockRouter(async () => ({
      data: JSON.stringify({
        intent: "entertainment", clarity: 0.8, bestHookSegmentId: "SEGMENT_QUI_NEXISTE_PAS", hookType: "curiosity",
        hookReasoning: "x", narrativeStructure: "three_act", overallTone: "fun", endingFeeling: "content", reasoning: "y",
      }),
    }));
    const plan2 = await runCreativeBrain(db, routerHalluc, project.id, segments, brief, style);
    assert(segments.some((s) => s.id === plan2.bestHook.segmentId), "l'accroche retombe sur un segment RÉEL (hallucination rejetée)");
    assert(plan2.hybridApproach === false && plan2.isFullyHeuristic === true, "plan 100% heuristique après rejet de l'hallucination");

    console.log("\n[3] Sans capacité LLM → plan 100% heuristique");
    const plan3 = await runCreativeBrain(db, mockRouter(null), project.id, segments, brief, style);
    assert(plan3.isFullyHeuristic === true && plan3.hybridApproach === false, "plan heuristique sans clé");
    assert(segments.some((s) => s.id === plan3.bestHook.segmentId), "accroche heuristique valide");

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

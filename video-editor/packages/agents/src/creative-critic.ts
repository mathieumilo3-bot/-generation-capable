/**
 * Creative Critic: évalue sévèrement le montage produit.
 *
 * Reçoit:
 * - EditBlueprint (le montage proposé)
 * - CreativePlan (la stratégie visée)
 * - Segments et metadata
 *
 * Produit:
 * - CreativeCriticismReport: diagnostic détaillé avec scores
 * - Identifie problèmes et recommandations
 * - Décide si itération nécessaire
 */

import type { Db } from "@video-editor/db";
import type { EditBlueprint, Segment, CreativePlan } from "@video-editor/shared-types";
import type { CreativeCriticismReport, CriticalScore } from "@video-editor/shared-types";
import { recordProviderCall } from "@video-editor/cost-ledger";

export async function runCreativeCritic(
  db: Db,
  projectId: string,
  renderId: string,
  blueprint: EditBlueprint,
  plan: CreativePlan,
  segments: Map<string, Segment>
): Promise<CreativeCriticismReport> {
  const t0 = Date.now();
  console.log(`[creative-critic] Evaluating render ${renderId} against creative plan…`);

  // Évaluer chaque dimension
  const hook = evaluateHook(blueprint, plan, segments);
  const retention = evaluateRetention(blueprint, plan, segments);
  const story = evaluateStory(blueprint, plan);
  const visual = evaluateVisuals(blueprint, plan);
  const captions = evaluateCaptions(blueprint, plan);
  const audio = evaluateAudio(blueprint, plan);
  const styleCoherence = evaluateStyleCoherence(blueprint, plan);
  const professionalism = evaluateProfessionalism(blueprint);
  const emotionalImpact = evaluateEmotionalImpact(blueprint, plan, segments);

  // Calculer les scores agrégés
  const creativeScore =
    (hook.score + retention.score + story.score + visual.score + emotionalImpact.score) / 5;
  const technicalScore = (captions.score + audio.score + professionalism.score + styleCoherence.score) / 4;
  const overallScore = (creativeScore * 0.6 + technicalScore * 0.4);

  // Identifier les problèmes
  const criticalIssues = identifyCriticalIssues(
    hook,
    retention,
    story,
    visual,
    captions,
    audio,
    overallScore,
    plan
  );

  // Décider si itération nécessaire
  const shouldIterate = overallScore < plan.qualityTargets.minRetentionScore || criticalIssues.length > 2;

  const report: CreativeCriticismReport = {
    id: `critic_${Date.now()}`,
    renderId,
    projectId,
    timestamp: new Date().toISOString(),
    version: 1,

    hook,
    retention,
    story,
    visual,
    captions,
    audio,
    styleCoherence,
    professionalism,
    emotionalImpact,

    creativeScore: Math.round(creativeScore),
    technicalScore: Math.round(technicalScore),
    overallScore: Math.round(overallScore),

    hookAnalysis: {
      strength: hook.score > 80 ? "excellent" : hook.score > 60 ? "strong" : "weak",
      clarity: hook.score > 75 ? "crystal_clear" : "clear",
      capturesAttention: hook.score > 60,
      promiseDelivered: "well_fulfilled",
      estimatedRetentionLift: Math.max(0, hook.score - 50),
    },

    retentionAnalysis: {
      slowSections: findSlowSections(blueprint, plan),
      deadWeight: findDeadWeight(blueprint, plan),
      pacing: retention.score > 75 ? "good" : retention.score > 50 ? "too_slow" : "too_fast",
      predictability: blueprint.clips.length > 8 ? "surprising" : "predictable",
      longueursIdentified: findSlowSegments(blueprint, plan).length,
    },

    storyAnalysis: {
      clarity: story.score > 75 ? "very_clear" : story.score > 50 ? "clear" : "confused",
      progression: "coherent",
      payoffStrength: story.score > 70 ? "strong" : "moderate",
      arcCompletion: Math.round((blueprint.clips.length / Math.max(blueprint.clips.length, 8)) * 100),
    },

    visualAnalysis: {
      variety: visual.score > 75 ? "diverse" : visual.score > 50 ? "moderate" : "repetitive",
      cadrage: "mixed",
      brollIntegration: blueprint.brollSlots.filter((s) => s.resolvedSource).length > 0
        ? "adequate"
        : "minimal",
      colorConsistency: true,
    },

    captionAnalysis: {
      readability: captions.score > 80 ? "excellent" : captions.score > 60 ? "readable" : "poor",
      synchronization: captions.score > 75 ? "perfect" : "approximate",
      emphasis: blueprint.captions.some((c) => c.words?.some((w) => w.emphasize))
        ? "effective"
        : "missing",
    },

    audioAnalysis: {
      voiceClarity: audio.score > 80 ? "excellent" : audio.score > 60 ? "good" : "poor",
      musicBalance: "balanced",
      sfxQuality: audio.score > 70 ? "clean" : "noisy",
      noiseLevel: audio.score > 75 ? "clean" : "moderate",
    },

    criticalIssues,

    strengths: [
      hook.score > 70 ? "Strong hook attracts attention immediately" : "",
      retention.score > 70 ? "Good pacing maintains viewer engagement" : "",
      visual.score > 70 ? "Diverse visuals prevent monotony" : "",
    ].filter(Boolean),

    weaknesses: [
      hook.score < 60 ? "Hook could be stronger or placed better" : "",
      retention.score < 60 ? "Pacing may lose viewers in middle section" : "",
      story.score < 60 ? "Narrative progression unclear" : "",
    ].filter(Boolean),

    opportunities: [
      retention.score < 80 ? "Add more B-roll to maintain visual interest" : "",
      hook.score < 80 ? "Consider testing alternative hook placement" : "",
    ].filter(Boolean),

    shouldIterate,
    maxIterationsRemaining: 2,

    isFullyLLM: false,
    isFullyHeuristic: true,
    reasoning: `Evaluated across ${Object.keys({
      hook,
      retention,
      story,
      visual,
      captions,
      audio,
      styleCoherence,
      professionalism,
      emotionalImpact,
    }).length} dimensions. Overall score ${Math.round(overallScore)} ${shouldIterate ? "warrants iteration" : "acceptable"}`,
  };

  const durationMs = Date.now() - t0;
  console.log(
    `[creative-critic] Evaluation complete: creative=${report.creativeScore}, technical=${report.technicalScore}, overall=${report.overallScore}`
  );

  recordProviderCall(db, {
    projectId,
    agent: "render_engine",
    stage: "creative_review",
    result: {
      data: null,
      provider: "stub",
      model: "creative_critic_v1",
      inputUnits: 1,
      inputUnitType: "blueprint",
      outputUnits: 1,
      outputUnitType: "criticism_report",
      durationMs,
      costMicroUsd: 0,
      isStub: true,
    },
  });

  return report;
}

// Utilitaires d'évaluation

function evaluateHook(blueprint: EditBlueprint, plan: CreativePlan, segments: Map<string, Segment>): CriticalScore {
  const firstClip = blueprint.clips[0];
  if (!firstClip) return { category: "hook", score: 0, confidence: 1 };

  const segment = segments.get(firstClip.rushId);
  const energyScore = segment ? segment.energy * 100 : 50;

  return {
    category: "hook",
    score: Math.min(100, energyScore + 20),
    strength: "Grabs attention within first second",
    confidence: 0.75,
  };
}

function evaluateRetention(blueprint: EditBlueprint, plan: CreativePlan, segments: Map<string, Segment>): CriticalScore {
  const avgClipDuration = blueprint.totalDurationSec / Math.max(blueprint.clips.length, 1);
  const targetDuration = plan.pacing.desiredAverageCutDurationSec;

  const paceScore = Math.max(0, 100 - Math.abs(avgClipDuration - targetDuration) * 10);
  const varietyScore = Math.min(100, blueprint.clips.length * 5);

  return {
    category: "retention",
    score: Math.round((paceScore + varietyScore) / 2),
    weakness: avgClipDuration > targetDuration * 1.5 ? "Clips are too long" : undefined,
    confidence: 0.7,
  };
}

function evaluateStory(blueprint: EditBlueprint, plan: CreativePlan): CriticalScore {
  const hasProgression = blueprint.clips.length >= 3;
  const hasPayoff = blueprint.clips.length > 0;

  const score = (hasProgression ? 50 : 30) + (hasPayoff ? 30 : 0);

  return {
    category: "story",
    score: Math.min(100, score),
    strength: hasProgression ? "Clear narrative progression" : undefined,
    confidence: 0.65,
  };
}

function evaluateVisuals(blueprint: EditBlueprint, plan: CreativePlan): CriticalScore {
  const zoomCount = blueprint.clips.filter((c) => c.zoomKeyframes.length > 0).length;
  const brollCount = blueprint.brollSlots.filter((s) => s.resolvedSource).length;

  const visualVariety = Math.min(100, (zoomCount + brollCount) * 8 + 40);

  return {
    category: "visual",
    score: Math.round(visualVariety),
    confidence: 0.7,
  };
}

function evaluateCaptions(blueprint: EditBlueprint, plan: CreativePlan): CriticalScore {
  const captionCount = blueprint.captions.length;
  const score = Math.min(100, captionCount > 0 ? 80 : 40);

  return {
    category: "captions",
    score,
    strength: captionCount > 0 ? "Captions present and timed" : undefined,
    confidence: 0.8,
  };
}

function evaluateAudio(blueprint: EditBlueprint, plan: CreativePlan): CriticalScore {
  const hasMusic = blueprint.music !== null;
  const score = hasMusic ? 70 : 50;

  return {
    category: "audio",
    score,
    strength: hasMusic ? "Music supports emotional curve" : "Voice only",
    confidence: 0.7,
  };
}

function evaluateStyleCoherence(blueprint: EditBlueprint, plan: CreativePlan): CriticalScore {
  return {
    category: "style_coherence",
    score: 75,
    strength: `Consistent with ${plan.stylePreset.name} style`,
    confidence: 0.75,
  };
}

function evaluateProfessionalism(blueprint: EditBlueprint): CriticalScore {
  return {
    category: "professionalism",
    score: 80,
    strength: "Clean cuts, proper timing",
    confidence: 0.8,
  };
}

function evaluateEmotionalImpact(blueprint: EditBlueprint, plan: CreativePlan, segments: Map<string, Segment>): CriticalScore {
  const avgEnergy = Array.from(segments.values()).reduce((sum, s) => sum + s.energy, 0) / Math.max(segments.size, 1);

  return {
    category: "emotional_impact",
    score: Math.round(avgEnergy * 100),
    confidence: 0.65,
  };
}

// Identification des problèmes

function identifyCriticalIssues(
  hook: CriticalScore,
  retention: CriticalScore,
  story: CriticalScore,
  visual: CriticalScore,
  captions: CriticalScore,
  audio: CriticalScore,
  overallScore: number,
  plan: CreativePlan
) {
  const issues = [];

  if (hook.score < plan.qualityTargets.minHookStrength) {
    issues.push({
      issue: "Weak hook",
      severity: "high" as const,
      correctionPriority: 1,
      suggestedAction: "Test alternative hook placement or content",
    });
  }

  if (retention.score < plan.qualityTargets.minRetentionScore) {
    issues.push({
      issue: "Poor retention pattern",
      severity: "high" as const,
      correctionPriority: 2,
      suggestedAction: "Reduce long clips, add more visual variety",
    });
  }

  if (visual.score < plan.qualityTargets.minVisualVariety) {
    issues.push({
      issue: "Insufficient visual variety",
      severity: "medium" as const,
      correctionPriority: 3,
      suggestedAction: "Add B-roll or increase zoom frequency",
    });
  }

  if (captions.score < 50) {
    issues.push({
      issue: "Missing or poorly timed captions",
      severity: "medium" as const,
      correctionPriority: 4,
      suggestedAction: "Add emphasis captions on key moments",
    });
  }

  return issues;
}

function findSlowSections(blueprint: EditBlueprint, plan: CreativePlan): string[] {
  return blueprint.clips
    .filter((c) => c.outDuration > plan.pacing.maxCutSec)
    .map((c) => c.id);
}

function findDeadWeight(blueprint: EditBlueprint, plan: CreativePlan): string[] {
  return blueprint.clips
    .filter((c) => c.outDuration > plan.pacing.desiredAverageCutDurationSec * 2)
    .slice(0, 3)
    .map((c) => c.id);
}

function findSlowSegments(blueprint: EditBlueprint, plan: CreativePlan): string[] {
  return blueprint.clips
    .filter((c) => c.outDuration > 4)
    .map((c) => c.id);
}

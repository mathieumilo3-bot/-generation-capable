/**
 * Creative Brain: agent principal qui produit le CreativePlan.
 *
 * Reçoit:
 * - brief utilisateur
 * - segments analysés
 * - style choisi
 * - références vidéo (optionnel)
 * - préférences utilisateur apprises (optionnel)
 *
 * Produit:
 * - CreativePlan: stratégie unifiée pour tout le montage
 *
 * Ce plan guide ensuite TOUS les autres agents.
 */

import type { Db } from "@video-editor/db";
import type { ModelRouter } from "@video-editor/model-router";
import type { Segment, StyleProfile, BriefSpec } from "@video-editor/shared-types";
import type {
  CreativePlan,
  HookCandidate,
  NarrativeArc,
  PacingStrategy,
  StylePreset,
} from "@video-editor/shared-types";
import { recordProviderCall } from "@video-editor/cost-ledger";

// Mapper BriefSpec.platform → CreativePlan.platform
function mapPlatform(briefPlatform: string): CreativePlan["platform"] {
  switch (briefPlatform) {
    case "tiktok":
      return "tiktok";
    case "instagram_reels":
      return "instagram";
    case "youtube_shorts":
      return "youtube";
    case "generic_vertical":
      return "custom";
    default:
      return "custom";
  }
}

// Mapper platform vers AudienceProfile.platformPreference
function mapToPlatformPreference(
  platform: CreativePlan["platform"]
): "tiktok" | "instagram" | "youtube" | "linkedin" | "podcast" | "mixed" {
  switch (platform) {
    case "custom":
      return "mixed";
    default:
      return platform as any;
  }
}

// Créer un StylePreset basé sur le StyleProfile
function styleProfileToPreset(profile: StyleProfile, brief: BriefSpec): StylePreset {
  return {
    name: profile.name,
    identifier: profile.id,
    description: `Profil de style basé sur ${profile.source === "preset" ? "preset" : "références vidéo"}`,
    recommendedFor: [brief.style, brief.tone],
    contentIntent: {
      primary: brief.platform.includes("shorts") || brief.platform.includes("reels") ? "entertainment" : "education",
    },
    camera: {
      approach: profile.cameraSwitchFrequency > 0.5 ? "dynamic" : "subtle",
      zoomFrequency: profile.zoomFrequency,
      cutDensity: 1 / Math.max(profile.averageCutDuration, 1),
    },
    pacing: {
      type: "adaptive",
      desiredAverageCutDurationSec: profile.averageCutDuration,
      minCutSec: Math.max(0.5, profile.averageCutDuration * 0.5),
      maxCutSec: profile.averageCutDuration * 2,
      patternInterrupts: profile.cameraSwitchFrequency,
    },
    broll: {
      approach: profile.brollDensity < 0.2 ? "minimal" : profile.brollDensity < 0.4 ? "contextual" : "illustrative",
      targetDensity: profile.brollDensity,
      purposes: ["context", "visual_interest"],
    },
    captions: {
      density: profile.captionEmphasis > 0.5 ? "dense" : "moderate",
      style: profile.captionStyle as any,
      emphasis: [],
    },
    sound: {
      musicRole: profile.musicIntensity < 0.2 ? "minimal" : profile.musicIntensity < 0.6 ? "supporting" : "leading",
      sfxDensity: profile.sfxDensity,
    },
    exemplaryCharacteristics: ["professional", "engaging"],
  };
}


export async function runCreativeBrain(
  db: Db,
  router: ModelRouter,
  projectId: string,
  segments: Segment[],
  briefSpec: BriefSpec,
  styleProfile: StyleProfile,
  referenceVideos?: string[]
): Promise<CreativePlan> {
  const t0 = Date.now();
  console.log(`[creative-brain] Analysing ${segments.length} segments for creative planning…`);

  // Dériver l'intention de contenu du brief
  const contentIntent = {
    primary: briefSpec.objective.toLowerCase().includes("education")
      ? ("education" as const)
      : ("entertainment" as const),
    clarity: 0.8,
  };

  // Mapper vers les plateformes supportées
  const platform = mapPlatform(briefSpec.platform);
  const platformPreference = mapToPlatformPreference(platform);
  const audience = {
    demographics: "general",
    platformPreference,
    attentionSpan: "short" as const,
  };

  // Trouver les meilleurs hooks
  const hookCandidates = findBestHooks(segments, 3);
  const bestHook = hookCandidates[0] ?? createFallbackHook(segments[0]);
  console.log(`[creative-brain] Best hook found: segment ${bestHook.segmentId} (score: ${bestHook.score})`);

  // Structure narrative basée sur le brief
  const narrativeArc = inferNarrativeArc(briefSpec, segments);

  // Générer StylePreset depuis le StyleProfile
  const stylePreset = styleProfileToPreset(styleProfile, briefSpec);

  // Pacing basé sur le profil de style
  const pacingStrategy: PacingStrategy = {
    type: "adaptive",
    desiredAverageCutDurationSec: styleProfile.averageCutDuration,
    minCutSec: Math.max(0.5, styleProfile.averageCutDuration * 0.5),
    maxCutSec: styleProfile.averageCutDuration * 2,
    energyCurve: generateEnergyCurve(narrativeArc),
    emphasisMoments: findEmphasisMoments(segments),
    patternInterrupts: styleProfile.cameraSwitchFrequency,
    isStub: true,
  };

  const plan: CreativePlan = {
    id: `plan_${Date.now()}`,
    projectId,
    createdAt: new Date().toISOString(),
    version: 1,

    contentIntent,
    audience,
    platform,
    format: "vertical",
    targetDurationSec: briefSpec.targetDurationSec,

    bestHook,
    alternativeHooks: hookCandidates.slice(1),
    shouldReorderSegments: bestHook.startSec !== (segments[0]?.start ?? 0),

    narrativeArc,
    endingStrategy: "payoff",
    retentionRisks: identifyRetentionRisks(segments),

    pacing: pacingStrategy,
    camera: {
      approach: styleProfile.cameraSwitchFrequency > 0.5 ? "dynamic" : "subtle",
      zoomFrequency: styleProfile.zoomFrequency,
      zoomIntensity: 0.4,
      cutDensity: 1 / Math.max(styleProfile.averageCutDuration, 1),
      framingApproach: "varied",
      isStub: true,
    },
    broll: {
      approach:
        styleProfile.brollDensity < 0.2
          ? "minimal"
          : styleProfile.brollDensity < 0.4
            ? "contextual"
            : "illustrative",
      targetDensity: styleProfile.brollDensity,
      purposes: ["context", "visual_interest"],
      types: ["environment", "product", "action"],
      isStub: true,
    },
    captions: {
      density: styleProfile.captionEmphasis > 0.5 ? "dense" : "moderate",
      style: "clean",
      timing: "phrase",
      emphasis: extractKeywords(briefSpec, segments),
      safety: "safe_area",
      isStub: true,
    },
    sound: {
      musicRole:
        styleProfile.musicIntensity < 0.2
          ? "minimal"
          : styleProfile.musicIntensity < 0.6
            ? "supporting"
            : "leading",
      musicIntensity: styleProfile.musicIntensity,
      voicePriority: "balanced",
      sfxDensity: styleProfile.sfxDensity,
      sfxPurpose: ["emphasis"],
      noiseReduction: true,
      compressionLevel: 0.6,
      isStub: true,
    },
    emotionalCurve: {
      moments: generateEmotionalMoments(segments),
      overallTone: briefSpec.tone,
      targetEndingFeeling: "satisfied",
    },
    visualPattern: "varied",
    stylePreset,
    qualityTargets: {
      minHookStrength: 60,
      minRetentionScore: 65,
      minVisualVariety: 50,
      minClarityScore: 70,
      minAudioQuality: 75,
      mustHavePayoff: true,
      maxRedundancy: 20,
    },
    reasoning:
      `Created creative plan targeting ${platform}. ` +
      `Selected hook from segment ${bestHook.segmentId} (${bestHook.type}) with score ${bestHook.score}. ` +
      `Using ${narrativeArc.structure} narrative structure.`,
    confidence: 0.75,
    isFullyLLM: false,
    isFullyHeuristic: true,
    hybridApproach: false,
  };

  const durationMs = Date.now() - t0;
  console.log(`[creative-brain] Plan created in ${(durationMs / 1000).toFixed(1)}s`);

  recordProviderCall(db, {
    projectId,
    agent: "render_engine",
    stage: "story_blueprint",
    result: {
      data: null,
      provider: "stub",
      model: "creative_brain_v1",
      inputUnits: segments.length,
      inputUnitType: "segments",
      outputUnits: 1,
      outputUnitType: "creative_plan",
      durationMs,
      costMicroUsd: 0,
      isStub: true,
    },
  });

  return plan;
}

// Utilitaires

function createFallbackHook(firstSegment: Segment | undefined): HookCandidate {
  return {
    segmentId: firstSegment?.id ?? "fallback",
    startSec: firstSegment?.start ?? 0,
    endSec: firstSegment?.end ?? 3,
    type: "curiosity",
    score: 50,
    reasoning: "Fallback hook (no high-energy segments found)",
    clarity: 0.5,
    retentionPotential: 50,
    isStub: true,
  };
}

function findBestHooks(segments: Segment[], count: number): HookCandidate[] {
  const candidates: HookCandidate[] = segments
    .filter((s) => s.energy > 0.5 || s.hookPotential > 0.6)
    .map((s) => ({
      segmentId: s.id,
      startSec: s.start,
      endSec: s.end,
      type: s.hookPotential > 0.7 ? ("pattern_interrupt" as const) : ("curiosity" as const),
      score: Math.round((s.energy * 100 + s.hookPotential * 100) / 2),
      reasoning: `Energy: ${(s.energy * 100).toFixed(0)}, Hook potential: ${(s.hookPotential * 100).toFixed(0)}`,
      clarity: s.clarity,
      retentionPotential: s.energy * 100,
      isStub: true,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);

  return candidates;
}

function inferNarrativeArc(brief: BriefSpec, segments: Segment[]): NarrativeArc {
  const structure: NarrativeArc["structure"] = brief.objective.toLowerCase().includes("education")
    ? "problem_solution"
    : "before_after";

  return {
    structure,
    acts: [
      { name: "Hook", targetDurationSec: 3, keyMoment: "first_impression", emotionalTone: "curiosity" },
      {
        name: "Setup",
        targetDurationSec: 5,
        keyMoment: "context",
        emotionalTone: "understanding",
      },
      {
        name: "Payoff",
        targetDurationSec: 5,
        keyMoment: "resolution",
        emotionalTone: "satisfaction",
      },
    ],
  };
}

function generateEnergyCurve(
  arc: NarrativeArc
): PacingStrategy["energyCurve"] {
  return [
    { timePercent: 0, intensityLevel: 90 },
    { timePercent: 0.3, intensityLevel: 60 },
    { timePercent: 0.7, intensityLevel: 70 },
    { timePercent: 1, intensityLevel: 80 },
  ];
}

function findEmphasisMoments(segments: Segment[]): string[] {
  return segments
    .filter((s) => s.narrativeInterest > 0.6 || s.hookPotential > 0.6)
    .slice(0, 5)
    .map((s) => s.id);
}

function identifyRetentionRisks(segments: Segment[]): string[] {
  const risks: string[] = [];

  const slowSegments = segments.filter((s) => s.energy < 0.3);
  if (slowSegments.length > segments.length * 0.2) {
    risks.push("Too many slow segments - risk of viewer drop-off");
  }

  const longSegments = segments.filter((s) => s.end - s.start > 6);
  if (longSegments.length > 3) {
    risks.push("Several long segments - may need additional cuts or B-roll");
  }

  return risks;
}

function extractKeywords(brief: BriefSpec, segments: Segment[]): string[] {
  const keywords: Set<string> = new Set();

  // Extraire du brief
  if (brief.objective) {
    brief.objective.split(/\s+/).slice(0, 3).forEach((word) => {
      if (word.length > 3) keywords.add(word.toLowerCase());
    });
  }

  // Ajouter le style et le ton
  keywords.add(brief.style);
  keywords.add(brief.tone);

  // Segments à haute pertinence
  segments
    .filter((s) => s.relevance > 0.7)
    .slice(0, 3)
    .forEach((s) => {
      if (s.transcript) {
        s.transcript.split(/\s+/).slice(0, 2).forEach((word) => {
          if (word.length > 3) keywords.add(word.toLowerCase());
        });
      }
    });

  return Array.from(keywords).slice(0, 10);
}

function generateEmotionalMoments(segments: Segment[]): CreativePlan["emotionalCurve"]["moments"] {
  return [
    { timePercent: 0, emotion: "curiosity", intensity: 0.9 },
    { timePercent: 0.3, emotion: "tension", intensity: 0.6 },
    { timePercent: 0.7, emotion: "revelation", intensity: 0.8 },
    { timePercent: 1, emotion: "satisfaction", intensity: 0.7 },
  ];
}

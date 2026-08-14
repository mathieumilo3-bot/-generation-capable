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
  ContentIntent,
  CreativePlan,
  HookCandidate,
  NarrativeArc,
  PacingStrategy,
  StylePreset,
} from "@video-editor/shared-types";
import { recordProviderCall } from "@video-editor/cost-ledger";
import { parseAndValidateJson } from "./llm-json.js";
import { resolveTargetDurationSec, usableContentDurationSec } from "./duration-policy.js";
import { z } from "zod";

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

  // Dériver l'intention de contenu du brief (élargissable par le LLM)
  const contentIntent: ContentIntent = {
    primary: briefSpec.objective.toLowerCase().includes("education") ? "education" : "entertainment",
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

  // DURÉE ÉDITORIALE : dérivée du contenu si non demandée (jamais 45s
  // inventé, §3/§24). Source de vérité pour toute la suite du montage.
  const durationDecision = resolveTargetDurationSec(briefSpec, segments);
  let targetDurationSec = durationDecision.targetSec;
  const contentSec = usableContentDurationSec(segments);
  console.log(`[creative-brain] Durée cible: ${targetDurationSec}s (${durationDecision.reason})`);

  // Trouver les meilleurs hooks (heuristique — base et repli)
  const hookCandidates = findBestHooks(segments, 3);
  let bestHook = hookCandidates[0] ?? createFallbackHook(segments[0]);

  // Structure narrative basée sur le brief (heuristique — base et repli)
  const narrativeArc = inferNarrativeArc(briefSpec, segments);
  let overallTone = briefSpec.tone;
  let endingFeeling = "satisfied";

  // DIRECTION LLM : quand une clé Anthropic est configurée, le directeur
  // RAISONNE réellement sur le contenu — intention, MEILLEURE accroche
  // (sur l'ensemble des plans, avec justification), structure narrative,
  // ton — au lieu des seules heuristiques. Tout id de segment renvoyé est
  // revérifié : une accroche hallucinée est rejetée, jamais suivie (§11).
  // Repli complet et silencieux sur l'heuristique en cas d'échec/absence.
  let usedLlm = false;
  let llmReasoning = "";
  if (router.capabilities.llm) {
    try {
      const dir = await llmCreativeDirection(db, router, projectId, segments, briefSpec, styleProfile);
      contentIntent.primary = dir.intent;
      contentIntent.clarity = dir.clarity;
      const hookSeg = segments.find((s) => s.id === dir.bestHookSegmentId);
      if (hookSeg) {
        bestHook = {
          segmentId: hookSeg.id,
          startSec: hookSeg.start,
          endSec: hookSeg.end,
          type: dir.hookType,
          score: Math.round(Math.max(bestHook.score, hookSeg.hookPotential * 100)),
          reasoning: dir.hookReasoning,
          clarity: hookSeg.clarity,
          retentionPotential: hookSeg.energy * 100,
          isStub: false,
        };
      }
      narrativeArc.structure = dir.narrativeStructure;
      overallTone = dir.overallTone;
      endingFeeling = dir.endingFeeling;
      // Le directeur peut affiner la durée — mais JAMAIS au-delà du contenu
      // disponible (pas de remplissage) et jamais en dessous de 3s.
      if (dir.targetDurationSec != null && !durationDecision.explicit) {
        const clamped = Math.max(3, Math.min(dir.targetDurationSec, contentSec > 0 ? contentSec : dir.targetDurationSec));
        targetDurationSec = Math.round(clamped * 10) / 10;
      }
      usedLlm = true;
      llmReasoning = dir.reasoning;
      console.log(`[creative-brain] Direction LLM: hook=${bestHook.segmentId} (${bestHook.type}), arc=${narrativeArc.structure}`);
    } catch (err) {
      console.warn(`[creative-brain] Direction LLM indisponible/invalide, heuristique conservée: ${(err as Error).message}`);
    }
  }
  console.log(`[creative-brain] Best hook: segment ${bestHook.segmentId} (score ${bestHook.score}, ${usedLlm ? "LLM" : "heuristique"})`);

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
    targetDurationSec,

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
      overallTone,
      targetEndingFeeling: endingFeeling,
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
      (usedLlm ? `[LLM] ${llmReasoning} ` : "") +
      `Cible ${platform}. Accroche = segment ${bestHook.segmentId} (${bestHook.type}). ` +
      `Structure ${narrativeArc.structure}.`,
    confidence: usedLlm ? 0.85 : 0.75,
    // Direction (intention/hook/arc/ton) par LLM, tactiques (pacing/broll/
    // captions/sound) encore heuristiques → approche hybride quand LLM.
    isFullyLLM: false,
    isFullyHeuristic: !usedLlm,
    hybridApproach: usedLlm,
  };

  const durationMs = Date.now() - t0;
  console.log(`[creative-brain] Plan created in ${(durationMs / 1000).toFixed(1)}s (${usedLlm ? "hybride LLM+heuristique" : "heuristique"})`);

  return plan;
}

// Direction créative par LLM (chemin réel quand une clé est configurée)

const LLM_DIRECTION_SCHEMA = z.object({
  intent: z.enum(["entertainment", "education", "persuasion", "inspiration", "documentation"]),
  clarity: z.number().min(0).max(1),
  /** Durée éditoriale conseillée (secondes) — null si aucune durée demandée et à laisser dériver du contenu. */
  targetDurationSec: z.number().positive().nullable().optional(),
  bestHookSegmentId: z.string(),
  hookType: z.enum(["curiosity", "pattern_interrupt", "authority", "emotion", "question", "revelation", "payoff"]),
  hookReasoning: z.string(),
  narrativeStructure: z.enum([
    "linear",
    "three_act",
    "hero_journey",
    "problem_solution",
    "before_after",
    "mystery_reveal",
    "emotional_journey",
  ]),
  overallTone: z.string(),
  endingFeeling: z.string(),
  reasoning: z.string(),
});

type LlmDirection = z.infer<typeof LLM_DIRECTION_SCHEMA>;

async function llmCreativeDirection(
  db: Db,
  router: ModelRouter,
  projectId: string,
  segments: Segment[],
  brief: BriefSpec,
  styleProfile: StyleProfile
): Promise<LlmDirection> {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const compact = segments.map((s) => ({
    id: s.id,
    start: r2(s.start),
    end: r2(s.end),
    transcript: s.transcript.slice(0, 180),
    scores: {
      energy: r2(s.energy),
      hookPotential: r2(s.hookPotential),
      narrativeInterest: r2(s.narrativeInterest),
      visualQuality: r2(s.visualQuality),
    },
  }));
  const result = await router.llm.complete({
    system: `Tu es le DIRECTEUR CRÉATIF d'un monteur vidéo IA pour formats courts verticaux
(TikTok/Reels/Shorts). À partir des segments analysés (jamais les rushs bruts), décide la
DIRECTION du montage. Réponds UNIQUEMENT en JSON:
{"intent":"entertainment|education|persuasion|inspiration|documentation","clarity":0..1,
"targetDurationSec": <nombre ou null : durée éditoriale idéale ; null si tu laisses dériver du contenu ; NE dépasse JAMAIS la durée totale des segments fournis, n'invente pas de durée pour "remplir">,
"bestHookSegmentId":"<un id EXISTANT de la liste>","hookType":"curiosity|pattern_interrupt|authority|emotion|question|revelation|payoff",
"hookReasoning":"...","narrativeStructure":"linear|three_act|hero_journey|problem_solution|before_after|mystery_reveal|emotional_journey",
"overallTone":"...","endingFeeling":"...","reasoning":"..."}
Règles : bestHookSegmentId DOIT être l'un des ids fournis (n'en invente aucun). Choisis
l'accroche qui capte le plus fort dès la première seconde (énergie, curiosité, rupture de
pattern). Priorité : rétention, clarté, naturel.`,
    prompt: `Brief: ${JSON.stringify(brief)}\nStyle: ${styleProfile.name} (cut ~${styleProfile.averageCutDuration}s)\nSegments disponibles:\n${JSON.stringify(compact)}`,
    maxTokens: 700,
  });
  recordProviderCall(db, { projectId, agent: "story_director", stage: "story_blueprint", result });
  const parsed = parseAndValidateJson(result.data, LLM_DIRECTION_SCHEMA);
  // Anti-hallucination : l'accroche désignée doit exister réellement.
  if (!segments.some((s) => s.id === parsed.bestHookSegmentId)) {
    throw new Error("Le modèle a désigné une accroche inexistante (hallucination) — direction rejetée.");
  }
  return parsed;
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

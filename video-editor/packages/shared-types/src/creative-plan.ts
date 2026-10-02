/**
 * Creative Plan: stratégie unifiée pour le montage vidéo.
 * Document de référence que tous les agents consultent.
 * Produit par le Creative Brain (agent principal).
 */

export interface ContentIntent {
  primary: "entertainment" | "education" | "persuasion" | "inspiration" | "documentation";
  secondary?: string;
  clarity: number; // 0-100 confiance dans l'intention
}

export interface AudienceProfile {
  demographics?: string;
  interests?: string[];
  platformPreference: "tiktok" | "instagram" | "youtube" | "linkedin" | "podcast" | "mixed";
  attentionSpan: "short" | "medium" | "long"; // secondes
  preferences?: string[];
}

export interface HookCandidate {
  segmentId: string;
  startSec: number;
  endSec: number;
  type: "curiosity" | "pattern_interrupt" | "authority" | "emotion" | "question" | "revelation" | "payoff";
  score: number; // 0-100
  reasoning: string;
  clarity: number;
  retentionPotential: number;
  isStub: boolean; // true = heuristique, false = LLM
}

export interface NarrativeArc {
  structure:
    | "linear"
    | "three_act"
    | "hero_journey"
    | "problem_solution"
    | "before_after"
    | "mystery_reveal"
    | "emotional_journey";
  acts: {
    name: string;
    targetDurationSec: number;
    keyMoment: string;
    emotionalTone: string;
  }[];
}

export interface PacingStrategy {
  type: "constant" | "adaptive" | "accelerating" | "emotional_curve";
  desiredAverageCutDurationSec: number;
  minCutSec: number;
  maxCutSec: number;
  energyCurve: {
    timePercent: number;
    intensityLevel: number; // 0-100
  }[];
  emphasisMoments: string[]; // "laisser respirer ici"
  patternInterrupts: number; // fréquence des changements visuels
  isStub: boolean;
}

export interface CameraStrategy {
  approach: "static" | "subtle" | "dynamic" | "aggressive";
  zoomFrequency: number; // 0-1
  zoomIntensity: number; // 0-1
  cutDensity: number; // 0-1
  framingApproach: "wide" | "medium" | "close" | "varied";
  isStub: boolean;
}

export interface BrollStrategy {
  approach: "minimal" | "contextual" | "illustrative" | "aggressive";
  targetDensity: number; // proportion of video that is B-roll
  purposes: ("context" | "visual_interest" | "emotion" | "proof" | "metaphor" | "brand_identity")[];
  types: ("environment" | "product" | "action" | "lifestyle" | "archival" | "motion_graphics")[];
  isStub: boolean;
}

export interface CaptionStrategy {
  density: "minimal" | "moderate" | "dense" | "aggressive";
  style: "clean" | "dynamic" | "karaoke" | "emphasis";
  timing: "word_by_word" | "phrase" | "sentence";
  emphasis: string[]; // mots à mettre en avant
  safety: "safe_area" | "full_screen"; // pour mobile
  isStub: boolean;
}

export interface SoundStrategy {
  musicRole: "absent" | "minimal" | "supporting" | "leading";
  musicIntensity: number; // 0-1
  voicePriority: "prominent" | "balanced" | "background";
  sfxDensity: number; // 0-1
  sfxPurpose: ("emphasis" | "transition" | "emotion" | "comedy" | "pattern_interrupt")[];
  noiseReduction: boolean;
  compressionLevel: number; // 0-1
  isStub: boolean;
}

export interface EmotionalCurve {
  moments: {
    timePercent: number;
    emotion: "curiosity" | "tension" | "emotion" | "humor" | "authority" | "revelation" | "satisfaction";
    intensity: number; // 0-1
  }[];
  overallTone: string;
  targetEndingFeeling: string;
}

export interface QualityTargets {
  minHookStrength: number; // 0-100
  minRetentionScore: number;
  minVisualVariety: number;
  minClarityScore: number;
  minAudioQuality: number;
  mustHavePayoff: boolean;
  maxRedundancy: number; // %
}

export interface StylePreset {
  name: string;
  identifier: string;
  description: string;
  recommendedFor: string[];
  contentIntent: Partial<ContentIntent>;
  camera: Partial<CameraStrategy>;
  pacing: Partial<PacingStrategy>;
  broll: Partial<BrollStrategy>;
  captions: Partial<CaptionStrategy>;
  sound: Partial<SoundStrategy>;
  exemplaryCharacteristics: string[];
}

export interface CreativePlan {
  id: string;
  projectId: string;
  createdAt: string;
  version: number;

  // Entrées
  contentIntent: ContentIntent;
  audience: AudienceProfile;
  platform: "tiktok" | "instagram" | "youtube" | "linkedin" | "podcast" | "custom";
  format: "vertical" | "horizontal" | "square";
  targetDurationSec: number;

  // Hookologie
  bestHook: HookCandidate;
  alternativeHooks: HookCandidate[];
  shouldReorderSegments: boolean; // si le meilleur hook n'est pas le premier

  // Stratégie narrative
  narrativeArc: NarrativeArc;
  endingStrategy: string; // "payoff rapide" "cut sec" "continuation" etc
  retentionRisks: string[];

  // Tactiques
  pacing: PacingStrategy;
  camera: CameraStrategy;
  broll: BrollStrategy;
  captions: CaptionStrategy;
  sound: SoundStrategy;

  // Émotion & esthétique
  emotionalCurve: EmotionalCurve;
  visualPattern: string;
  colorGrade?: string;
  stylePreset: StylePreset;

  // Qualité
  qualityTargets: QualityTargets;

  // Metadata
  reasoning: string;
  confidence: number; // 0-1
  isFullyLLM: boolean;
  isFullyHeuristic: boolean;
  hybridApproach: boolean;
}

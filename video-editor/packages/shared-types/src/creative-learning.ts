/**
 * Creative Learning Engine: apprentissage des préférences de montage de l'utilisateur.
 * Cumule les signaux au fil du temps pour personnaliser les futures vidéos.
 */

export interface EditingPreferences {
  // Timing & rythme
  cutDurationPreference: number; // secondes
  cutDensityPreference: number; // 0-1
  zoomFrequency: number; // 0-1
  pauseDensity: number; // combien de respirations
  patternInterruptFrequency: number; // 0-1

  // B-roll
  brollDensity: number; // 0-1 proportion
  brollTypes: string[]; // préférences
  brollPurposes: string[];

  // Captions
  captionDensity: "minimal" | "moderate" | "dense" | "aggressive";
  captionStyle: "clean" | "dynamic" | "karaoke" | "emphasis";
  captionEmphasisLevel: number; // 0-1

  // Audio
  musicIntensity: number; // 0-1
  sfxDensity: number; // 0-1
  voicePriority: "prominent" | "balanced" | "background";

  // Éditing
  preferredHookType: string;
  narrativeStructurePreference: string;
  endingPreference: string;
  transitionStyle: "cuts" | "dissolves" | "mixed";

  // Émotion
  targetTone: string[];
  preferredEmotionalCurve: string;
  riskTolerance: "conservative" | "moderate" | "adventurous"; // disposé à du neuf

  // Général
  confidenceLevel: number; // 0-1
  lastUpdated: string;
  sampleSize: number; // nombre d'actions ayant informé ces prefs
}

export interface FeedbackSignal {
  type:
    | "video_accepted"
    | "video_rejected"
    | "hook_rejected"
    | "pacing_feedback"
    | "visual_feedback"
    | "audio_feedback"
    | "caption_feedback"
    | "broll_feedback"
    | "emotion_feedback"
    | "style_feedback"
    | "command_adjustment"
    | "manual_edit"
    | "user_rating";

  parameter?: string; // ex: "cutDensity"
  oldValue?: string | number;
  newValue?: string | number;
  adjustment?: "increase" | "decrease" | "change" | "remove" | "add";
  magnitude: number; // 0-1 intensité du feedback

  timestamp: string;
  projectId: string;
  renderId?: string;
  confidence: number; // 0-1 confiance que ce feedback est intentionnel

  source: "explicit" | "inferred"; // utilisateur l'a dit ou on l'a déduit
  reasoning?: string;
}

export interface PerformanceSignal {
  projectId: string;
  renderId: string;
  platformMetrics?: {
    views?: number;
    averageWatchTime?: number;
    completionRate?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
  };
  estimatedQuality: number; // 0-100 basé sur QC scores
  userEngagement: "low" | "medium" | "high" | "unknown";
  timestamp: string;
}

export interface CreativePreferenceProfile {
  userId: string;
  editingPreferences: EditingPreferences;
  feedbackHistory: FeedbackSignal[];
  performanceHistory: PerformanceSignal[];
  stylePreferences: {
    preferredStyle: string;
    dislikedStyles: string[];
  };
  referencesPreferred: {
    videoId: string;
    timestamp: string;
    influenceWeight: number; // 0-1
  }[];

  // Méta-apprentissage
  learningRate: number; // 0-1 rapidité d'adaptation
  adaptationPhase: "exploration" | "exploitation" | "refinement"; // étape d'apprentissage
  convergenceConfidence: number; // 0-1 on est sûrs des prefs
  lastModified: string;
}

export type CreativeInsight = {
  type:
    | "user_prefers_faster_cuts"
    | "user_prefers_more_broll"
    | "user_prefers_subtle_emotion"
    | "user_avoids_pattern_interrupts"
    | "user_wants_cleaner_captions"
    | "user_values_authority_tone"
    | "user_likes_storytelling_structure"
    | "user_prefers_minimal_effects"
    | "user_wants_high_energy"
    | "user_prefers_educational_approach";
  confidence: number; // 0-1
  evidenceCount: number;
  lastConfirmed: string;
};

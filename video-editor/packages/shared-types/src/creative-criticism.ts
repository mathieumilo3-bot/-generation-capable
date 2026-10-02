/**
 * Rapport du Creative Critic: évaluation sévère du montage.
 * Le Critic n'accepte aucun compromis.
 */

export interface CriticalScore {
  category: string;
  score: number; // 0-100
  strength?: string;
  weakness?: string;
  confidence: number; // 0-1
}

export interface CreativeCriticismReport {
  id: string;
  renderId: string;
  projectId: string;
  timestamp: string;
  version: number;

  // Scores détaillés
  hook: CriticalScore;
  retention: CriticalScore;
  story: CriticalScore;
  visual: CriticalScore;
  captions: CriticalScore;
  audio: CriticalScore;
  styleCoherence: CriticalScore;
  professionalism: CriticalScore;
  emotionalImpact: CriticalScore;

  // Agrégats
  creativeScore: number; // moyenne pondérée des scores créatifs
  technicalScore: number; // qualité technique
  overallScore: number; // score final

  // Évaluation du Hook
  hookAnalysis: {
    strength: "weak" | "moderate" | "strong" | "excellent";
    clarity: "unclear" | "moderate" | "clear" | "crystal_clear";
    capturesAttention: boolean;
    promiseDelivered: string;
    estimatedRetentionLift: number; // %
  };

  // Évaluation de la rétention
  retentionAnalysis: {
    slowSections: string[];
    deadWeight: string[];
    pacing: "too_slow" | "good" | "too_fast";
    predictability: "predictable" | "balanced" | "surprising";
    longueursIdentified: number;
  };

  // Évaluation de la narration
  storyAnalysis: {
    clarity: "confused" | "clear" | "very_clear";
    progression: string;
    payoffStrength: "weak" | "moderate" | "strong";
    arcCompletion: number; // 0-100
  };

  // Évaluation visuelle
  visualAnalysis: {
    variety: "repetitive" | "moderate" | "diverse";
    cadrage: string;
    brollIntegration: "absent" | "minimal" | "adequate" | "excellent";
    colorConsistency: boolean;
  };

  // Évaluation des captions
  captionAnalysis: {
    readability: "poor" | "readable" | "excellent";
    synchronization: "off" | "approximate" | "perfect";
    emphasis: "missing" | "moderate" | "effective";
  };

  // Évaluation audio
  audioAnalysis: {
    voiceClarity: "poor" | "good" | "excellent";
    musicBalance: "too_loud" | "balanced" | "too_quiet";
    sfxQuality: string;
    noiseLevel: "high" | "moderate" | "clean";
  };

  // Problèmes détectés
  criticalIssues: {
    issue: string;
    severity: "low" | "medium" | "high" | "critical";
    correctionPriority: number; // 1-10
    suggestedAction: string;
  }[];

  // Recommandations
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  shouldIterate: boolean;
  maxIterationsRemaining: number;

  // Métadonnées
  isFullyLLM: boolean;
  isFullyHeuristic: boolean;
  reasoning: string;
}

export type CreativeDecision =
  | "accept_as_is"
  | "iterate"
  | "reorder_segments"
  | "change_hook"
  | "adjust_pacing"
  | "add_broll"
  | "remove_broll"
  | "adjust_captions"
  | "adjust_audio"
  | "fail";

export interface CorrectionPlan {
  id: string;
  renderId: string;
  criticalIssue: string;
  decision: CreativeDecision;
  actions: {
    action: string;
    parameter?: string;
    value?: string | number | boolean;
    impact: string;
  }[];
  expectedImprovement: number; // 0-100 points
  estimatedCost: "low" | "medium" | "high"; // en appels LLM
}

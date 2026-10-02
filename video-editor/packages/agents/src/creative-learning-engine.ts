/**
 * Creative Learning Engine: apprend les préférences de montage de l'utilisateur.
 *
 * Cumule les signaux de feedback au fil du temps.
 * Met à jour progressivement les préférences sans changements brutaux.
 *
 * Signaux tractés:
 * - Vidéos acceptées vs rejetées
 * - Ajustements manuels (plus rapide, plus lent, plus de B-roll, etc.)
 * - Métriques de performance (si disponibles)
 */

import type { Db } from "@video-editor/db";
import type { CreativePreferenceProfile, FeedbackSignal, EditingPreferences } from "@video-editor/shared-types";

export class CreativeLearningEngine {
  private profile: CreativePreferenceProfile;

  constructor(userId: string, existingProfile?: CreativePreferenceProfile) {
    this.profile = existingProfile ?? initializeProfile(userId);
  }

  /**
   * Enregistrer un signal de feedback (utilisateur accepte/rejette/ajuste)
   */
  recordFeedback(signal: FeedbackSignal): void {
    console.log(`[learning] Recording feedback: ${signal.type} on ${signal.parameter || "general"}`);

    // Ajouter au historique
    this.profile.feedbackHistory.push(signal);

    // Mettre à jour les préférences basé sur le signal
    this.updatePreferencesFromSignal(signal);

    // Mettre à jour timestamp
    this.profile.lastModified = new Date().toISOString();
  }

  /**
   * Obtenir les préférences actuelles de montage
   */
  getPreferences(): EditingPreferences {
    return this.profile.editingPreferences;
  }

  /**
   * Obtenir le profil complet
   */
  getProfile(): CreativePreferenceProfile {
    return this.profile;
  }

  /**
   * Actualiser le profil avec des données de performance externes
   * (ex: views, retention rate depuis un platform d'hébergement vidéo)
   */
  updateWithPerformanceData(metrics: {
    renderId: string;
    completionRate?: number;
    avgWatchTime?: number;
    likes?: number;
  }): void {
    const existingSignal = this.profile.performanceHistory.find((p) => p.renderId === metrics.renderId);

    if (!existingSignal) {
      console.log(`[learning] Recording performance data for render ${metrics.renderId}`);

      this.profile.performanceHistory.push({
        projectId: "",
        renderId: metrics.renderId,
        platformMetrics: metrics,
        estimatedQuality: 75,
        userEngagement: metrics.completionRate ? "high" : "medium",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Implémentation privée

  private updatePreferencesFromSignal(signal: FeedbackSignal): void {
    const prefs = this.profile.editingPreferences;

    // Calculer le learning rate basé sur la phase
    const baseLearningRate = {
      exploration: 0.15,
      exploitation: 0.08,
      refinement: 0.03,
    }[this.profile.adaptationPhase];

    const learningRate = baseLearningRate * (signal.confidence ?? 0.5);

    // Mettre à jour selon le type de feedback
    switch (signal.type) {
      case "command_adjustment":
        if (signal.parameter === "cutDensity" && signal.adjustment === "increase") {
          prefs.cutDensityPreference =
            prefs.cutDensityPreference + (0.1 * learningRate);
        } else if (signal.parameter === "cutDensity" && signal.adjustment === "decrease") {
          prefs.cutDensityPreference =
            Math.max(0, prefs.cutDensityPreference - 0.1 * learningRate);
        }

        if (signal.parameter === "zoomFrequency" && signal.adjustment === "increase") {
          prefs.zoomFrequency = Math.min(1, prefs.zoomFrequency + 0.1 * learningRate);
        } else if (signal.parameter === "zoomFrequency" && signal.adjustment === "decrease") {
          prefs.zoomFrequency = Math.max(0, prefs.zoomFrequency - 0.1 * learningRate);
        }

        if (signal.parameter === "brollDensity" && signal.adjustment === "increase") {
          prefs.brollDensity = Math.min(1, prefs.brollDensity + 0.1 * learningRate);
        } else if (signal.parameter === "brollDensity" && signal.adjustment === "decrease") {
          prefs.brollDensity = Math.max(0, prefs.brollDensity - 0.1 * learningRate);
        }

        if (signal.parameter === "sfxDensity" && signal.adjustment === "increase") {
          prefs.sfxDensity = Math.min(1, prefs.sfxDensity + 0.1 * learningRate);
        } else if (signal.parameter === "sfxDensity" && signal.adjustment === "decrease") {
          prefs.sfxDensity = Math.max(0, prefs.sfxDensity - 0.1 * learningRate);
        }
        break;

      case "pacing_feedback":
        if (signal.adjustment === "increase") {
          prefs.cutDensityPreference = Math.min(1, prefs.cutDensityPreference + 0.08 * learningRate);
        } else if (signal.adjustment === "decrease") {
          prefs.cutDensityPreference = Math.max(0, prefs.cutDensityPreference - 0.08 * learningRate);
        }
        break;

      case "visual_feedback":
        if (signal.adjustment === "increase") {
          prefs.zoomFrequency = Math.min(1, prefs.zoomFrequency + 0.1 * learningRate);
          prefs.brollDensity = Math.min(1, prefs.brollDensity + 0.1 * learningRate);
        }
        break;

      case "audio_feedback":
        if (signal.adjustment === "increase") {
          prefs.sfxDensity = Math.min(1, prefs.sfxDensity + 0.1 * learningRate);
          prefs.musicIntensity = Math.min(1, prefs.musicIntensity + 0.1 * learningRate);
        } else if (signal.adjustment === "decrease") {
          prefs.sfxDensity = Math.max(0, prefs.sfxDensity - 0.1 * learningRate);
          prefs.musicIntensity = Math.max(0, prefs.musicIntensity - 0.1 * learningRate);
        }
        break;

      case "video_accepted":
        // Renforcer les paramètres actuels
        if (signal.magnitude > 0.7) {
          this.profile.convergenceConfidence = Math.min(1, this.profile.convergenceConfidence + 0.05);
        }
        break;

      case "video_rejected":
        // Réduire la confiance, explorer davantage
        this.profile.convergenceConfidence = Math.max(0, this.profile.convergenceConfidence - 0.1);
        if (this.profile.adaptationPhase !== "exploration") {
          this.profile.adaptationPhase = "exploration";
        }
        break;
    }

    // Mettre à jour le sample size et la confiance
    this.profile.editingPreferences.sampleSize += 1;
    this.profile.editingPreferences.confidenceLevel = Math.max(
      0,
      Math.min(
        1,
        0.3 + this.profile.editingPreferences.sampleSize * 0.02 * (signal.confidence ?? 0.5)
      )
    );

    // Décider de la phase d'apprentissage basée sur la confiance
    if (this.profile.editingPreferences.confidenceLevel > 0.7) {
      this.profile.adaptationPhase = "refinement";
    } else if (this.profile.editingPreferences.confidenceLevel > 0.4) {
      this.profile.adaptationPhase = "exploitation";
    } else {
      this.profile.adaptationPhase = "exploration";
    }
  }
}

function initializeProfile(userId: string): CreativePreferenceProfile {
  const defaultPrefs: EditingPreferences = {
    cutDurationPreference: 2.5,
    cutDensityPreference: 0.4,
    zoomFrequency: 0.3,
    pauseDensity: 0.2,
    patternInterruptFrequency: 0.3,
    brollDensity: 0.3,
    brollTypes: ["environment", "product"],
    brollPurposes: ["context"],
    captionDensity: "moderate",
    captionStyle: "clean",
    captionEmphasisLevel: 0.5,
    musicIntensity: 0.4,
    sfxDensity: 0.2,
    voicePriority: "balanced",
    preferredHookType: "curiosity",
    narrativeStructurePreference: "three_act",
    endingPreference: "payoff",
    transitionStyle: "cuts",
    targetTone: ["upbeat", "engaging"],
    preferredEmotionalCurve: "building",
    riskTolerance: "moderate",
    confidenceLevel: 0,
    lastUpdated: new Date().toISOString(),
    sampleSize: 0,
  };

  return {
    userId,
    editingPreferences: defaultPrefs,
    feedbackHistory: [],
    performanceHistory: [],
    stylePreferences: {
      preferredStyle: "personal_branding",
      dislikedStyles: [],
    },
    referencesPreferred: [],
    learningRate: 0.1,
    adaptationPhase: "exploration",
    convergenceConfidence: 0,
    lastModified: new Date().toISOString(),
  };
}

/**
 * Créer une copie avec des ajustements basés sur les préférences apprises
 */
export function applyLearningToStrategy(
  strategy: any,
  preferences: EditingPreferences
): any {
  return {
    ...strategy,
    desiredAverageCutDurationSec: preferences.cutDurationPreference,
    cutDensity: preferences.cutDensityPreference,
    zoomFrequency: preferences.zoomFrequency,
    brollDensity: preferences.brollDensity,
    sfxDensity: preferences.sfxDensity,
    musicIntensity: preferences.musicIntensity,
  };
}

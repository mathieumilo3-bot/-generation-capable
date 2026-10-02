import { z } from "zod";

export const CaptionStyleSchema = z.enum(["bold_dynamic", "minimal_clean", "karaoke_word", "classic_lowerthird"]);
export const TransitionStyleSchema = z.enum(["hard_cut", "soft_fade", "whip_pan", "mixed"]);

/**
 * Profil de style quantifié — soit extrait de vidéos de référence
 * (Agent 10), soit un preset interne. C'est la seule source de vérité
 * pour la couche déterministe de rythme dans l'Editor Agent (Agent 04) :
 * le LLM ne décide jamais un timing de coupe à partir de rien.
 */
export const StyleProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.enum(["preset", "reference_videos"]),
  averageCutDuration: z.number().positive(),
  hookDuration: z.number().positive(),
  zoomFrequency: z.number().min(0).max(1),
  brollDensity: z.number().min(0).max(1),
  captionStyle: CaptionStyleSchema,
  captionEmphasis: z.number().min(0).max(1),
  transitionStyle: TransitionStyleSchema,
  musicIntensity: z.number().min(0).max(1),
  sfxDensity: z.number().min(0).max(1),
  cameraSwitchFrequency: z.number().min(0).max(1),
});

export type StyleProfile = z.infer<typeof StyleProfileSchema>;

/**
 * Presets internes du MVP (§6 du brief). Volontairement peu nombreux et
 * grossiers — le vrai différenciant est l'extraction depuis des
 * références utilisateur, pas la richesse du catalogue de presets.
 */
export const BUILT_IN_STYLE_PROFILES: StyleProfile[] = [
  {
    id: "preset_premium_clean",
    name: "Premium — épuré",
    source: "preset",
    averageCutDuration: 2.6,
    hookDuration: 2.5,
    zoomFrequency: 0.18,
    brollDensity: 0.2,
    captionStyle: "minimal_clean",
    captionEmphasis: 0.15,
    transitionStyle: "hard_cut",
    musicIntensity: 0.4,
    sfxDensity: 0.1,
    cameraSwitchFrequency: 0.3,
  },
  {
    id: "preset_dynamic_social",
    name: "Dynamique — réseaux sociaux",
    source: "preset",
    averageCutDuration: 1.8,
    hookDuration: 2.0,
    zoomFrequency: 0.32,
    brollDensity: 0.27,
    captionStyle: "bold_dynamic",
    captionEmphasis: 0.35,
    transitionStyle: "hard_cut",
    musicIntensity: 0.65,
    sfxDensity: 0.3,
    cameraSwitchFrequency: 0.55,
  },
  {
    id: "preset_aggressive_hype",
    name: "Très dynamique — hype",
    source: "preset",
    averageCutDuration: 1.1,
    hookDuration: 1.4,
    zoomFrequency: 0.5,
    brollDensity: 0.35,
    captionStyle: "karaoke_word",
    captionEmphasis: 0.6,
    transitionStyle: "whip_pan",
    musicIntensity: 0.85,
    sfxDensity: 0.5,
    cameraSwitchFrequency: 0.75,
  },
];

/**
 * Les 18 étapes du pipeline, dans l'ordre. C'est la même liste que
 * l'orchestrateur (packages/pipeline) fait avancer et que l'UI affiche
 * comme progression réelle — jamais une barre de progression simulée.
 */
export const PIPELINE_STAGES = [
  "upload",
  "storage",
  "proxy_generation",
  "transcription",
  "video_analysis",
  "style_analysis",
  "brief_analysis",
  "story_blueprint",
  "edit_blueprint",
  "broll",
  "captions",
  "sound",
  "creative_review",
  "proxy_render",
  "quality_control",
  "correction",
  "final_render",
  "delivery",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Libellé affiché à l'utilisateur — jamais de jargon technique dans l'UI. */
export const STAGE_LABEL_FR: Record<PipelineStage, string> = {
  upload: "Réception des rushs…",
  storage: "Mise en sécurité des fichiers…",
  proxy_generation: "Préparation des rushs pour l'analyse…",
  transcription: "Transcription…",
  video_analysis: "Analyse des rushs…",
  style_analysis: "Analyse du style demandé…",
  brief_analysis: "Compréhension de la demande…",
  story_blueprint: "Construction du storytelling…",
  edit_blueprint: "Construction du montage…",
  broll: "Sélection du B-roll…",
  captions: "Ajout des sous-titres…",
  sound: "Composition du son…",
  creative_review: "Revue de cohérence…",
  proxy_render: "Rendu d'aperçu…",
  quality_control: "Contrôle qualité…",
  correction: "Correction ciblée…",
  final_render: "Export final…",
  delivery: "Livraison…",
};

export type JobStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface StageProgress {
  stage: PipelineStage;
  status: JobStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

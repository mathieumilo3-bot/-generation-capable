/**
 * Le coût est stocké en microdollars (1 USD = 1_000_000) pour ne jamais
 * accumuler d'erreurs d'arrondi flottant sur des appels qui coûtent
 * parfois 0,0003 $. Toute agrégation/affichage divise par 1_000_000 au
 * dernier moment. Voir §10 du brief : chaque appel externe doit être
 * traçable, sans exception.
 */
export type MicroUsd = number;

export function usdToMicro(usd: number): MicroUsd {
  return Math.round(usd * 1_000_000);
}
export function microToUsd(micro: MicroUsd): number {
  return micro / 1_000_000;
}

export type CostProvider =
  | "anthropic"
  | "google_gemini"
  | "openai"
  | "deepgram"
  | "assemblyai"
  | "stock_library"
  | "internal_ffmpeg"
  | "internal_remotion"
  | "stub";

export type CostAgent =
  | "brief_analyzer"
  | "video_analyzer"
  | "style_extractor"
  | "story_director"
  | "editor"
  | "broll_director"
  | "caption_director"
  | "sound_designer"
  | "creative_director"
  | "quality_control"
  | "render_engine";

export interface CostLedgerEntry {
  id: string;
  projectId: string;
  agent: CostAgent;
  provider: CostProvider;
  model: string;
  stage: string;
  callType: "llm" | "vision" | "stt" | "ttv" | "music" | "render" | "other";
  inputUnits: number; // tokens, secondes audio, secondes vidéo générées... selon callType
  inputUnitType: string;
  outputUnits: number;
  outputUnitType: string;
  durationMs: number;
  costMicroUsd: MicroUsd;
  isStub: boolean; // true si calculé en mode démo (pas d'appel réseau réel)
  createdAt: string;
}

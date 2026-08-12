import { usdToMicro } from "@video-editor/shared-types";

/**
 * Table de prix — vérifiée publiquement en août 2026 (voir dossier
 * stratégique §06). Ce marché change de leader tous les trimestres :
 * cette table est un point de départ à revalider avant tout engagement
 * financier, pas une vérité figée. Toute estimation de coût calculée en
 * mode stub (sans clé API) utilise ces chiffres et est marquée `isStub`
 * dans le cost_ledger — ce n'est jamais une facture réelle.
 */
export const PRICING = {
  anthropicSonnetPerMillionTokensInUsd: 3,
  anthropicSonnetPerMillionTokensOutUsd: 15,
  geminiFlashPerMillionTokensInUsd: 0.3,
  geminiFlashPerMillionTokensOutUsd: 2.5,
  deepgramNova3PerMinuteUsd: 0.0077,
  stockMediaPerClipUsd: 0, // catalogue licencié, coût amorti en abonnement fournisseur — voir §10
} as const;

export function llmCostMicroUsd(inputTokens: number, outputTokens: number): number {
  const inUsd = (inputTokens / 1_000_000) * PRICING.anthropicSonnetPerMillionTokensInUsd;
  const outUsd = (outputTokens / 1_000_000) * PRICING.anthropicSonnetPerMillionTokensOutUsd;
  return usdToMicro(inUsd + outUsd);
}

export function visionCostMicroUsd(inputTokens: number, outputTokens: number): number {
  const inUsd = (inputTokens / 1_000_000) * PRICING.geminiFlashPerMillionTokensInUsd;
  const outUsd = (outputTokens / 1_000_000) * PRICING.geminiFlashPerMillionTokensOutUsd;
  return usdToMicro(inUsd + outUsd);
}

export function sttCostMicroUsd(audioSeconds: number): number {
  const minutes = audioSeconds / 60;
  return usdToMicro(minutes * PRICING.deepgramNova3PerMinuteUsd);
}

import type { CostProvider } from "@video-editor/shared-types";

/**
 * Résultat uniforme de tout appel de fournisseur, réel ou stub. Le
 * cost-ledger complet (id, projectId, agent, stage) est assemblé par
 * l'appelant (packages/agents) — le router ne connaît pas le contexte
 * métier, seulement l'appel technique. Voir §10-11 du brief produit :
 * chaque appel externe doit être traçable, et jamais coupler le coût au
 * fournisseur dans la couche agent (sinon changer de fournisseur oblige à
 * réécrire la logique de coût partout).
 */
export interface ProviderCallResult<T> {
  data: T;
  provider: CostProvider;
  model: string;
  inputUnits: number;
  inputUnitType: string;
  outputUnits: number;
  outputUnitType: string;
  durationMs: number;
  costMicroUsd: number;
  /** true si aucun appel réseau réel n'a été fait (pas de clé API configurée). */
  isStub: boolean;
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}

import type { ProviderCallResult } from "./types.js";

/**
 * Interface préparée pour la génération de B-roll IA — explicitement
 * HORS du cœur du MVP (§5 Agent 05 du brief : stock avant génération,
 * génération plus tard). Un seul fournisseur stub aujourd'hui ; brancher
 * Kling/Veo/Seedance plus tard consiste à ajouter une implémentation de
 * cette interface, pas à changer le B-roll Director.
 */
export interface TtvGenerateParams {
  prompt: string;
  durationSec: number;
}

export interface TtvProvider {
  readonly isReal: boolean;
  generate(params: TtvGenerateParams): Promise<ProviderCallResult<{ filePath: string | null }>>;
}

export class StubTtvProvider implements TtvProvider {
  readonly isReal = false;

  async generate(params: TtvGenerateParams): Promise<ProviderCallResult<{ filePath: string | null }>> {
    return {
      data: { filePath: null },
      provider: "stub",
      model: "stub-ttv",
      inputUnits: params.durationSec,
      inputUnitType: "seconds_requested",
      outputUnits: 0,
      outputUnitType: "seconds_generated",
      durationMs: 0,
      costMicroUsd: 0,
      isStub: true,
    };
  }
}

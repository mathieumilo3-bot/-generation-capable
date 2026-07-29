/**
 * Un routage ambigu (0 ou plusieurs agents compétents) doit être remonté
 * à l'humain plutôt que résolu par une supposition (voir
 * docs/gc-ai-os/02-architecture-globale.md, "L'Orchestrateur" — Router).
 */
export class RoutingAmbiguityError extends Error {
  constructor(
    public readonly requiredDomain: string,
    public readonly candidateAgentIds: string[],
  ) {
    super(
      candidateAgentIds.length === 0
        ? `Aucun agent compétent pour le domaine "${requiredDomain}"`
        : `Routage ambigu pour le domaine "${requiredDomain}" : plusieurs agents candidats (${candidateAgentIds.join(", ")})`,
    );
    this.name = "RoutingAmbiguityError";
  }
}

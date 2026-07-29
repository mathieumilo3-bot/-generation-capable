import type { Connector, ConnectorExecutionContext, ConnectorResult } from "@gc-ai-os/shared-types";

/**
 * Exemple de connecteur (voir docs/gc-ai-os/05-connecteurs.md). Squelette
 * volontairement minimal pour la phase 1 : les capacités et niveaux de
 * risque sont déclarés, l'implémentation réelle des appels à l'API
 * GitHub est un chantier séparé du chantier d'architecture.
 */
export class GithubConnector implements Connector {
  readonly id = "github";

  readonly capabilities = [
    { name: "create_pull_request", riskLevel: "low" as const },
    { name: "merge_pull_request", riskLevel: "medium" as const },
    { name: "create_branch", riskLevel: "low" as const },
  ];

  async execute<T = unknown>(
    capability: string,
    params: Record<string, unknown>,
    _context: ConnectorExecutionContext,
  ): Promise<ConnectorResult<T>> {
    switch (capability) {
      case "create_pull_request":
      case "merge_pull_request":
      case "create_branch":
        return {
          ok: false,
          error: `Capacité "${capability}" déclarée mais non implémentée (squelette phase 1). params=${JSON.stringify(params)}`,
        };
      default:
        return { ok: false, error: `Capacité inconnue : ${capability}` };
    }
  }
}

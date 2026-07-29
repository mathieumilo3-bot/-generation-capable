import type { Connector } from "@gc-ai-os/shared-types";

/**
 * Registre de connecteurs (voir docs/gc-ai-os/05-connecteurs.md). Ajouter
 * un connecteur = implémenter `Connector` puis l'enregistrer ici — jamais
 * modifier la passerelle (gateway.ts) ou l'Orchestrateur.
 */
export class ConnectorRegistry {
  private readonly connectors = new Map<string, Connector>();

  register(connector: Connector): void {
    if (this.connectors.has(connector.id)) {
      throw new Error(`Connecteur déjà enregistré : ${connector.id}`);
    }
    this.connectors.set(connector.id, connector);
  }

  get(connectorId: string): Connector | undefined {
    return this.connectors.get(connectorId);
  }

  list(): Connector[] {
    return [...this.connectors.values()];
  }
}

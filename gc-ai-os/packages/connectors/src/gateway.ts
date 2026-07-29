import { createHash } from "node:crypto";
import type { AuthorizationService } from "@gc-ai-os/security";
import type { ConnectorResult } from "@gc-ai-os/shared-types";
import type { ConnectorRegistry } from "./registry.js";

export interface GatewayCallParams {
  agentId: string;
  roleId: string;
  connectorId: string;
  capability: string;
  params: Record<string, unknown>;
  taskId: string | null;
}

/**
 * Seul point d'entrée par lequel un agent peut invoquer une capacité de
 * connecteur (voir docs/gc-ai-os/05-connecteurs.md et 06-securite.md). Un
 * agent n'appelle jamais un connecteur directement — il passe toujours
 * par `ConnectorGateway.call`, ce qui rend le contrôle de permission et
 * l'audit impossibles à contourner par erreur de code dans un agent.
 */
export class ConnectorGateway {
  constructor(
    private readonly connectors: ConnectorRegistry,
    private readonly authorization: AuthorizationService,
  ) {}

  async call<T = unknown>(request: GatewayCallParams): Promise<ConnectorResult<T>> {
    const connector = this.connectors.get(request.connectorId);
    if (!connector) {
      return { ok: false, error: `Connecteur introuvable : ${request.connectorId}` };
    }

    const capability = connector.capabilities.find(
      (c) => c.name === request.capability,
    );
    if (!capability) {
      return {
        ok: false,
        error: `Capacité inconnue "${request.capability}" pour le connecteur "${request.connectorId}"`,
      };
    }

    const paramsHash = createHash("sha256")
      .update(JSON.stringify(request.params))
      .digest("hex");

    const { decision, requiresHumanValidation } = await this.authorization.authorize({
      agentId: request.agentId,
      roleId: request.roleId,
      capability: `${request.connectorId}.${request.capability}`,
      riskLevel: capability.riskLevel,
      paramsHash,
      taskId: request.taskId,
    });

    if (decision === "denied") {
      return { ok: false, error: "Action refusée par le RBAC" };
    }

    if (decision === "escalated" && requiresHumanValidation) {
      // Action critique : mise en file de validation humaine (voir
      // 06-securite.md). L'exécution effective se fait dans un second
      // temps, après approbation explicite — jamais ici.
      return { ok: false, error: "Action en attente de validation humaine" };
    }

    return connector.execute<T>(request.capability, request.params, {
      agentId: request.agentId,
      taskId: request.taskId,
    });
  }
}

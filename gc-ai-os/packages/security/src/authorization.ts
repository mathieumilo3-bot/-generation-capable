import type {
  AuditDecision,
  AuditLogEntry,
  RiskLevel,
  RolePermission,
} from "@gc-ai-os/shared-types";
import { randomUUID } from "node:crypto";

export interface PermissionStore {
  getPermission(
    roleId: string,
    capability: string,
  ): Promise<RolePermission | undefined>;
}

export interface AuditSink {
  record(entry: AuditLogEntry): Promise<void>;
}

export interface AuthorizationRequest {
  agentId: string;
  roleId: string;
  capability: string;
  riskLevel: RiskLevel;
  paramsHash: string;
  taskId: string | null;
}

export interface AuthorizationResult {
  decision: AuditDecision;
  requiresHumanValidation: boolean;
}

/**
 * Point de passage obligé pour toute capacité de connecteur (voir
 * docs/gc-ai-os/06-securite.md). Politique "deny by default" : une
 * capacité sans permission explicite pour le rôle est refusée, jamais
 * autorisée par omission.
 *
 * Chaque appel — autorisé, refusé ou escaladé — est journalisé. Ce
 * service ne doit jamais être contourné : la couche connecteurs
 * (packages/connectors) l'invoque systématiquement avant `execute`.
 */
export class AuthorizationService {
  constructor(
    private readonly permissions: PermissionStore,
    private readonly auditSink: AuditSink,
  ) {}

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const permission = await this.permissions.getPermission(
      request.roleId,
      request.capability,
    );

    const decision = this.decide(permission);

    await this.auditSink.record({
      id: randomUUID(),
      actorAgentId: request.agentId,
      capability: request.capability,
      paramsHash: request.paramsHash,
      riskLevel: request.riskLevel,
      decision,
      taskId: request.taskId,
      executedAt: new Date().toISOString(),
    });

    return {
      decision,
      requiresHumanValidation: permission?.requiresHumanValidation ?? false,
    };
  }

  private decide(permission: RolePermission | undefined): AuditDecision {
    if (!permission || !permission.allowed) {
      return "denied";
    }
    if (permission.requiresHumanValidation) {
      return "escalated";
    }
    return "allowed";
  }
}

import { beforeEach, describe, expect, it } from "vitest";
import type { AuditLogEntry, RolePermission } from "@gc-ai-os/shared-types";
import { AuthorizationService, type AuditSink, type PermissionStore } from "./authorization";

function stores() {
  const permissions = new Map<string, RolePermission>();
  const log: AuditLogEntry[] = [];

  const store: PermissionStore = {
    async getPermission(roleId, capability) {
      return permissions.get(`${roleId}::${capability}`);
    },
  };
  const sink: AuditSink = {
    async record(entry) {
      log.push(entry);
    },
  };

  return {
    store,
    sink,
    log,
    grant(permission: RolePermission) {
      permissions.set(`${permission.roleId}::${permission.capability}`, permission);
    },
  };
}

describe("AuthorizationService — deny by default", () => {
  let ctx: ReturnType<typeof stores>;
  let service: AuthorizationService;

  const request = {
    agentId: "finance-agent",
    roleId: "finance-agent",
    capability: "stripe.create_refund",
    riskLevel: "critical" as const,
    paramsHash: "abc",
    taskId: "t1",
  };

  beforeEach(() => {
    ctx = stores();
    service = new AuthorizationService(ctx.store, ctx.sink);
  });

  it("refuse une capacité pour laquelle aucune permission n'existe", async () => {
    // Le comportement le plus important du système : l'ajout d'un
    // connecteur ne donne accès à personne tant qu'une permission n'est
    // pas accordée explicitement.
    const result = await service.authorize(request);
    expect(result.decision).toBe("denied");
  });

  it("refuse une permission explicitement désactivée", async () => {
    ctx.grant({ ...request, allowed: false, requiresHumanValidation: false });
    const result = await service.authorize(request);
    expect(result.decision).toBe("denied");
  });

  it("autorise une permission accordée sans validation humaine", async () => {
    ctx.grant({ ...request, allowed: true, requiresHumanValidation: false });
    const result = await service.authorize(request);
    expect(result.decision).toBe("allowed");
    expect(result.requiresHumanValidation).toBe(false);
  });

  it("escalade — n'autorise jamais — une capacité exigeant validation humaine", async () => {
    ctx.grant({ ...request, allowed: true, requiresHumanValidation: true });
    const result = await service.authorize(request);

    expect(result.decision).toBe("escalated");
    expect(result.decision).not.toBe("allowed");
    expect(result.requiresHumanValidation).toBe(true);
  });

  it("journalise une action refusée au même titre qu'une action autorisée", async () => {
    // Sans cela, on ne voit jamais les tentatives anormales.
    await service.authorize(request);
    expect(ctx.log).toHaveLength(1);
    expect(ctx.log[0]!.decision).toBe("denied");
    expect(ctx.log[0]!.actorAgentId).toBe("finance-agent");
    expect(ctx.log[0]!.capability).toBe("stripe.create_refund");
  });

  it("journalise chaque appel, y compris répété", async () => {
    await service.authorize(request);
    await service.authorize(request);
    expect(ctx.log).toHaveLength(2);
  });

  it("conserve le niveau de risque et la tâche dans la trace d'audit", async () => {
    await service.authorize(request);
    expect(ctx.log[0]!.riskLevel).toBe("critical");
    expect(ctx.log[0]!.taskId).toBe("t1");
  });

  it("n'accorde pas une permission d'un rôle à un autre", async () => {
    ctx.grant({
      roleId: "ceo-agent",
      capability: "stripe.create_refund",
      allowed: true,
      requiresHumanValidation: false,
    });

    const result = await service.authorize(request);
    expect(result.decision).toBe("denied");
  });
});

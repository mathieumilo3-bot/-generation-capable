import type { Agent, AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Registre d'agents. Volontairement dépourvu de toute logique de routage —
 * le routage vit dans l'Orchestrateur (voir packages/orchestrator). Ce
 * registre expose uniquement l'inscription et la consultation, pour que
 * l'ajout d'un agent ne nécessite jamais de modifier ce module (voir
 * docs/gc-ai-os/03-agents.md, section "Extensibilité").
 */
export class AgentRegistry {
  private readonly agents = new Map<string, Agent>();

  register(agent: Agent): void {
    const { id } = agent.manifest;
    if (this.agents.has(id)) {
      throw new Error(`Agent déjà enregistré : ${id}`);
    }
    this.agents.set(id, agent);
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  get(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  list(): AgentManifest[] {
    return [...this.agents.values()].map((agent) => agent.manifest);
  }

  /** Agents dont le domaine déclaré correspond au domaine recherché. */
  findByDomain(domain: string): Agent[] {
    return [...this.agents.values()].filter(
      (agent) => agent.manifest.domain === domain,
    );
  }
}

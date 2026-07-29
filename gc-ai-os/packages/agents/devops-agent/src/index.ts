import { BaseAgent } from "@gc-ai-os/agents-core";
import type { AgentManifest, Task, TaskResult } from "@gc-ai-os/shared-types";

/**
 * DevOps Agent (voir docs/gc-ai-os/03-agents.md). CI/CD, déploiement,
 * infrastructure. Tout déploiement en production est une action
 * critique (voir docs/gc-ai-os/06-securite.md) : ce squelette de phase 1
 * ne fait qu'illustrer le contrat d'agent, l'appel réel au connecteur de
 * déploiement est un chantier séparé.
 */
export class DevopsAgent extends BaseAgent {
  readonly manifest: AgentManifest = {
    id: "devops-agent",
    name: "DevOps Agent",
    domain: "infrastructure",
    role: "CI/CD, déploiement, infrastructure",
    responsibilities: [
      "Pipelines GitHub Actions",
      "Déploiements Vercel/Netlify",
      "Monitoring d'infrastructure",
    ],
    tools: ["github.create_pull_request", "github.merge_pull_request"],
    memory: {
      scope: "agent",
      readAccess: ["technical"],
    },
    model: "claude-sonnet-5",
  };

  protected async execute(task: Task): Promise<TaskResult> {
    return {
      status: "escalated",
      summary: `Déploiement non implémenté dans ce squelette (tâche: ${task.title}). Action classée critique — nécessite le connecteur de déploiement et une validation humaine.`,
    };
  }
}

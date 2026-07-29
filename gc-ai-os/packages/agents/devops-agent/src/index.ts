import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * DevOps Agent (voir docs/gc-ai-os/03-agents.md). CI/CD, déploiement,
 * infrastructure. Toute demande de déploiement ou d'action sur
 * l'infrastructure réelle est traitée comme critique (voir
 * docs/gc-ai-os/06-securite.md) et explicitement refusée/escaladée tant
 * que le connecteur de déploiement n'est pas implémenté.
 */
export class DevopsAgent extends ConversationalAgent {
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

  protected readonly criticalPatterns = [
    /d[ée]ploie/i,
    /mets?\s+en\s+prod/i,
    /\bdeploy\b/i,
    /red[ée]marre\s+le\s+serveur/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

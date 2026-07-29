import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Backend Agent (voir docs/gc-ai-os/03-agents.md). Logique métier
 * serveur, API, intégrations — côté Génération Capable, notamment les
 * fonctions Netlify (ai-proxy, ambassador-data) et leurs contrats.
 */
export class BackendAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "backend-agent",
    name: "Backend Agent",
    domain: "backend",
    role: "Logique métier serveur, API, intégrations",
    responsibilities: [
      "Endpoints et fonctions serveur",
      "Logique d'orchestration métier hors agents IA",
      "Contrats d'API stables",
    ],
    tools: ["github.create_pull_request"],
    memory: {
      scope: "agent",
      readAccess: ["technical", "project"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /d[ée]ploie/i,
    /merge\s+.*prod/i,
    /supprime\s+(la\s+)?fonction\s+(en\s+)?prod/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

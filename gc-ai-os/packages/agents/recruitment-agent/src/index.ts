import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Recruitment Agent (voir docs/gc-ai-os/03-agents.md). Support au
 * recrutement — sourcing, présélection de candidatures, aide à la
 * structuration du process de recrutement.
 */
export class RecruitmentAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "recruitment-agent",
    name: "Recruitment Agent",
    domain: "recrutement",
    role: "Support au recrutement",
    responsibilities: [
      "Sourcing",
      "Présélection de candidatures",
      "Aide à la structuration du process de recrutement",
    ],
    tools: [],
    memory: {
      scope: "agent",
      readAccess: ["business"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [/envoie\s+l'offre/i, /signe\s+le\s+contrat/i];

  constructor(model: ModelProvider) {
    super(model);
  }
}

import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Automation Agent (voir docs/gc-ai-os/03-agents.md). Automatisation des
 * processus internes — création et maintenance de workflows n8n/Make,
 * réduction des tâches manuelles répétitives entre agents et outils
 * tiers.
 */
export class AutomationAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "automation-agent",
    name: "Automation Agent",
    domain: "automatisation",
    role: "Automatisation des processus internes",
    responsibilities: [
      "Création et maintenance de workflows n8n/Make",
      "Réduction des tâches manuelles répétitives entre agents et outils tiers",
    ],
    tools: [],
    memory: {
      scope: "agent",
      readAccess: ["technical", "project"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /active\s+(le|ce)\s+workflow/i,
    /d[ée]ploie\s+(le|ce)\s+workflow/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

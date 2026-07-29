import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Data Agent (voir docs/gc-ai-os/03-agents.md). Données et analytics
 * internes — pipelines, tableaux de bord, qualité des données. Chez
 * Génération Capable, cela couvre notamment les métriques de commission
 * et de conversion déjà trackées (voir GC_BUSINESS_CONTEXT).
 */
export class DataAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "data-agent",
    name: "Data Agent",
    domain: "donnees",
    role: "Données et analytics internes",
    responsibilities: [
      "Pipelines de données",
      "Tableaux de bord analytiques",
      "Qualité des données",
    ],
    tools: ["supabase.execute_sql"],
    memory: {
      scope: "agent",
      readAccess: ["technical", "business"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [/supprime.*donn[ée]es/i, /purge/i];

  constructor(model: ModelProvider) {
    super(model);
  }
}

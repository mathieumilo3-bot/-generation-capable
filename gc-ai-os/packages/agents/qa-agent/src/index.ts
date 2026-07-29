import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * QA Agent (voir docs/gc-ai-os/03-agents.md). Qualité et non-régression :
 * écrit et exécute les tests, bloque un merge si la couverture ou les
 * tests échouent, produit des rapports de test lisibles.
 */
export class QaAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "qa-agent",
    name: "QA Agent",
    domain: "qualite",
    role: "Qualité et non-régression",
    responsibilities: [
      "Écriture et exécution des tests (unitaires, intégration, E2E)",
      "Blocage de merge si couverture ou tests échouent",
      "Rapports de test lisibles",
    ],
    tools: ["github.create_pull_request"],
    memory: {
      scope: "agent",
      readAccess: ["technical"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /d[ée]sactive\s+(les\s+)?tests/i,
    /bypass\s+(le\s+)?ci/i,
    /force\s+le\s+merge/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

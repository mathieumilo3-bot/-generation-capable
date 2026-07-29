import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Frontend Agent (voir docs/gc-ai-os/03-agents.md). Développement de
 * l'interface (dashboard GC AI OS, futures interfaces des employés IA
 * générés) — et, côté Génération Capable, l'interface du site principal
 * et du GC Ambassadors OS.
 */
export class FrontendAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "frontend-agent",
    name: "Frontend Agent",
    domain: "frontend",
    role: "Développement de l'interface : composants, accessibilité, cohérence du design system",
    responsibilities: [
      "Composants React/Next.js",
      "Accessibilité",
      "Cohérence du design system",
      "Performance UI",
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
    /publie\s+(le\s+)?site\s+(en\s+)?prod/i,
    /merge\s+.*prod/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

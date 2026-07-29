import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * CTO Agent (voir docs/gc-ai-os/03-agents.md). Garant de l'architecture
 * technique et des standards de qualité. Conversationnel dès la phase 1 :
 * répond aux questions d'architecture, de revue de code, de choix
 * technique. Les actions réelles (écrire du code, ouvrir une PR) restent
 * hors scope tant que les connecteurs correspondants ne sont pas
 * implémentés.
 */
export class CtoAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "cto-agent",
    name: "CTO Agent",
    domain: "architecture-technique",
    role: "Garant de l'architecture technique et des standards de qualité",
    responsibilities: [
      "Revue d'architecture avant tout développement significatif",
      "Arbitrage technique entre les agents de développement",
      "Maintien des standards de code (Clean Architecture, SOLID, TS strict)",
    ],
    tools: ["github.create_pull_request"],
    memory: {
      scope: "agent",
      readAccess: ["global", "technical", "project"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /d[ée]ploi(e|er|ement)s?\s+en\s+prod/i,
    /merge\s+(la\s+)?pr\s+.*prod/i,
    /supprim(e|er)\s+(la\s+)?base\s+de\s+donn[ée]es/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

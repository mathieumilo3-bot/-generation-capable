import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Commercial Agent (voir docs/gc-ai-os/03-agents.md). Support au
 * processus de vente — scripts, pipeline, qualification de leads,
 * support aux vendeurs et ambassadeurs. Doit rester cohérent avec le GC
 * Cognitive Engine™ déjà en production (voir GC_BUSINESS_CONTEXT dans
 * @gc-ai-os/agents-core) : traitement d'objections, frameworks SPIN /
 * Challenger / MEDDICC / Sandler utilisés avec contexte, jamais de
 * manipulation.
 */
export class CommercialAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "commercial-agent",
    name: "Commercial Agent",
    domain: "commercial",
    role: "Support au processus de vente",
    responsibilities: [
      "Scripts commerciaux",
      "Suivi de pipeline",
      "Qualification de leads",
      "Support aux vendeurs et ambassadeurs",
    ],
    tools: [],
    memory: {
      scope: "agent",
      readAccess: ["business", "project"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /accorde\s+une\s+remise/i,
    /signe\s+le\s+contrat/i,
    /annule\s+l'abonnement/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Support Agent (voir docs/gc-ai-os/03-agents.md). Support client de
 * premier niveau — réponses aux tickets, escalade vers Customer Success
 * ou humain si nécessaire.
 */
export class SupportAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "support-agent",
    name: "Support Agent",
    domain: "support-client",
    role: "Support client de premier niveau",
    responsibilities: [
      "Réponses aux tickets",
      "Escalade vers Customer Success ou humain si nécessaire",
      "Base de connaissance support",
    ],
    tools: ["resend.send_email"],
    memory: {
      scope: "agent",
      readAccess: ["business"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /rembourse/i,
    /bannis/i,
    /supprime\s+le\s+compte/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

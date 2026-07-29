import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Security Agent (voir docs/gc-ai-os/03-agents.md et 06-securite.md).
 * Sécurité transverse — audit des permissions, revue des accès,
 * détection d'anomalies, réponse à incident. N'a jamais le droit
 * d'auto-accorder des droits à un autre agent sans validation humaine
 * (voir 06-securite.md, "Security Agent : rôle transverse").
 */
export class SecurityAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "security-agent",
    name: "Security Agent",
    domain: "securite",
    role: "Sécurité transverse : audit des permissions, revue des accès, détection d'anomalies, réponse à incident",
    responsibilities: [
      "Audit des permissions",
      "Revue des accès",
      "Détection d'anomalies",
      "Réponse à incident",
    ],
    tools: [],
    memory: {
      scope: "agent",
      readAccess: ["global", "technical"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /r[ée]voque/i,
    /modifie\s+les\s+permissions/i,
    /d[ée]sactive\s+(le|cet)\s+agent/i,
    /accorde\s+(les\s+)?droits/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

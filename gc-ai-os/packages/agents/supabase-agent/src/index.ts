import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Supabase Agent (voir docs/gc-ai-os/03-agents.md). Spécialiste base de
 * données et plateforme Supabase — le projet réel de Génération Capable
 * (table `ambassadors`, auth par magic link, voir
 * ambassador-data.js) est le premier terrain d'application concret.
 */
export class SupabaseAgent extends ConversationalAgent {
  readonly manifest: AgentManifest = {
    id: "supabase-agent",
    name: "Supabase Agent",
    domain: "base-de-donnees",
    role: "Spécialiste base de données et plateforme Supabase",
    responsibilities: [
      "Migrations et schéma",
      "Politiques RLS",
      "Edge Functions",
      "Revue de performance de requêtes",
    ],
    tools: ["supabase.apply_migration", "supabase.execute_sql", "supabase.get_advisors"],
    memory: {
      scope: "agent",
      readAccess: ["technical"],
    },
    model: "claude-sonnet-5",
  };

  protected readonly criticalPatterns = [
    /migration.*(prod|production)/i,
    /supprime\s+(la\s+)?(table|colonne|base)/i,
    /drop\s+table/i,
    /d[ée]sactive\s+(la\s+)?rls/i,
  ];

  constructor(model: ModelProvider) {
    super(model);
  }
}

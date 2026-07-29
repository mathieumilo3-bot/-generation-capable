import { AgentRegistry } from "@gc-ai-os/agents-core";
import { AutomationAgent } from "@gc-ai-os/automation-agent";
import { BackendAgent } from "@gc-ai-os/backend-agent";
import { CeoAgent } from "@gc-ai-os/ceo-agent";
import { CommercialAgent } from "@gc-ai-os/commercial-agent";
import { ContentAgent } from "@gc-ai-os/content-agent";
import { CtoAgent } from "@gc-ai-os/cto-agent";
import { CustomerSuccessAgent } from "@gc-ai-os/customer-success-agent";
import { DataAgent } from "@gc-ai-os/data-agent";
import { DevopsAgent } from "@gc-ai-os/devops-agent";
import { FinanceAgent } from "@gc-ai-os/finance-agent";
import { FrontendAgent } from "@gc-ai-os/frontend-agent";
import { LegalAgent } from "@gc-ai-os/legal-agent";
import { MarketingAgent } from "@gc-ai-os/marketing-agent";
import { MemoryClient } from "@gc-ai-os/memory";
import { createModelProvider } from "@gc-ai-os/model-provider";
import { KeywordDomainClassifier, Orchestrator } from "@gc-ai-os/orchestrator";
import { QaAgent } from "@gc-ai-os/qa-agent";
import { RecruitmentAgent } from "@gc-ai-os/recruitment-agent";
import { ResearchAgent } from "@gc-ai-os/research-agent";
import { AuthorizationService } from "@gc-ai-os/security";
import { SecurityAgent } from "@gc-ai-os/security-agent";
import { SupabaseAgent } from "@gc-ai-os/supabase-agent";
import { SupportAgent } from "@gc-ai-os/support-agent";
import { LocalHashEmbeddingProvider } from "./local-embedding";
import { SqliteRuntimeStore } from "./sqlite-store";

export interface GcRuntime {
  orchestrator: Orchestrator;
  store: SqliteRuntimeStore;
  /** "anthropic" si ANTHROPIC_API_KEY est configurée, "fallback" sinon. */
  modelMode: "anthropic" | "fallback";
}

/**
 * Assemble l'instance locale de GC AI OS (voir docs/gc-ai-os/09-roadmap.md,
 * phase 1) : enregistre les 19 agents du catalogue (voir
 * docs/gc-ai-os/03-agents.md), initialise le RBAC avec uniquement la
 * capacité "converser" accordée à chacun (deny-by-default pour tout le
 * reste, voir docs/gc-ai-os/06-securite.md), et construit l'Orchestrateur
 * branché sur le store SQLite.
 *
 * CEO Agent est enregistré en premier : c'est le domaine par défaut du
 * classifieur (voir domain-classifier.ts) quand aucun mot-clé plus
 * spécifique ne correspond — cohérent avec son rôle de généraliste /
 * synthèse plutôt qu'un agent technique comme porte d'entrée du chat.
 */
export function bootstrapRuntime(dbPath: string): GcRuntime {
  const store = new SqliteRuntimeStore(dbPath);
  const model = createModelProvider();

  const registry = new AgentRegistry();
  registry.register(new CeoAgent(model));
  registry.register(new CtoAgent(model));
  registry.register(new FrontendAgent(model));
  registry.register(new BackendAgent(model));
  registry.register(new SupabaseAgent(model));
  registry.register(new DevopsAgent(model));
  registry.register(new QaAgent(model));
  registry.register(new MarketingAgent(model));
  registry.register(new CommercialAgent(model));
  registry.register(new SupportAgent(model));
  registry.register(new FinanceAgent(model));
  registry.register(new ContentAgent(model));
  registry.register(new ResearchAgent(model));
  registry.register(new DataAgent(model));
  registry.register(new LegalAgent(model));
  registry.register(new AutomationAgent(model));
  registry.register(new SecurityAgent(model));
  registry.register(new CustomerSuccessAgent(model));
  registry.register(new RecruitmentAgent(model));

  for (const manifest of registry.list()) {
    store.grantPermission({
      roleId: manifest.id,
      capability: `${manifest.id}.converse`,
      allowed: true,
      requiresHumanValidation: false,
    });
  }

  const authorization = new AuthorizationService(store, store);
  const memory = new MemoryClient(store, new LocalHashEmbeddingProvider());

  // Routage par mots-clés (voir domain-classifier.ts) : réglé pour
  // n'assigner un domaine que quand un mot-clé lui est propre, sinon le
  // message retombe sur le domaine du premier agent enregistré (CEO
  // Agent, généraliste). Ordre des règles = priorité en cas de multiple
  // correspondance.
  const classifier = new KeywordDomainClassifier([
    { domain: "base-de-donnees", pattern: /supabase|migration|base de donn[ée]es|\bsql\b|\brls\b|requ[êe]te sql/i },
    { domain: "infrastructure", pattern: /d[ée]ploi|\binfra\b|serveur|ci\/cd|pipeline|netlify|vercel|h[ée]bergement|cloudflare/i },
    { domain: "frontend", pattern: /interface\b|composant react|design system|accessibilit[ée]|\bcss\b|\bui\b/i },
    { domain: "backend", pattern: /\bapi\b|endpoint|logique m[ée]tier|backend/i },
    { domain: "qualite", pattern: /\btest\b|\bbug\b|r[ée]gression|couverture de test|\bqa\b/i },
    { domain: "marketing", pattern: /campagne|marketing|\bseo\b|r[ée]seaux sociaux|contenu tiktok|positionnement/i },
    { domain: "commercial", pattern: /vente\b|pipeline commercial|script commercial|prospect|closing|objection/i },
    { domain: "support-client", pattern: /ticket|support client|r[ée]clamation/i },
    { domain: "finance", pattern: /facture|facturation|stripe|rembours|budget|abonnement/i },
    { domain: "contenu", pattern: /formation\b|r[ée]di(ge|ger|action)|article\b|guide de style/i },
    { domain: "recherche", pattern: /veille\b|benchmark|concurrent/i },
    { domain: "donnees", pattern: /analytics|tableau de bord|dashboard de donn[ée]es|pipeline de donn[ée]es/i },
    { domain: "conformite", pattern: /rgpd|contrat\b|conformit[ée]|juridique|\bcgv\b|\bcgu\b/i },
    { domain: "automatisation", pattern: /workflow|\bn8n\b|make\.com|automat(isation|ise|iser)/i },
    { domain: "securite", pattern: /audit de s[ée]curit[ée]|permission|incident de s[ée]curit[ée]|acc[èe]s\b/i },
    { domain: "succes-client", pattern: /onboarding|r[ée]tention|satisfaction client|\bchurn\b/i },
    { domain: "recrutement", pattern: /recrut(ement|e|er)|candidature|sourcing|poste [àa] pourvoir/i },
    { domain: "architecture-technique", pattern: /architecture|revue de code|refactor|standard de code|dette technique/i },
  ]);

  const orchestrator = new Orchestrator(registry, store, {
    classifier,
    authorization,
    memory,
  });

  return { orchestrator, store, modelMode: model.mode };
}

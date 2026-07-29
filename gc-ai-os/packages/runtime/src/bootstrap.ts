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
import { AgentFactory, DeclarativeAgent } from "@gc-ai-os/factory";
import { ExecutiveEngine } from "@gc-ai-os/executive";
import {
  DeliverableValidator,
  GoalEngine,
  ModelPlanner,
  PlaybookPlanner,
} from "@gc-ai-os/goals";
import { ConnectorGateway, ConnectorRegistry, GithubConnector, StripeConnector } from "@gc-ai-os/connectors";
import { MetricRegistry } from "@gc-ai-os/metrics";
import { HumanBrain } from "@gc-ai-os/people";
import { SkillRegistry } from "@gc-ai-os/telemetry";
import { SqliteExecutiveStore } from "./executive-store";
import { LocalHashEmbeddingProvider } from "./local-embedding";
import {
  SqliteGoalStore,
  decisionSinkOf,
  deliverableStoreOf,
  keyResultStoreOf,
  missionStoreOf,
  objectiveStoreOf,
  publishedAgentStoreOf,
  skillRepositoryOf,
} from "./goal-store";
import { SqliteRuntimeStore } from "./sqlite-store";

export interface GcRuntime {
  orchestrator: Orchestrator;
  store: SqliteRuntimeStore;
  goalStore: SqliteGoalStore;
  goalEngine: GoalEngine;
  executive: ExecutiveEngine;
  skills: SkillRegistry;
  factory: AgentFactory;
  agents: AgentRegistry;
  metrics: MetricRegistry;
  humanBrain: HumanBrain;
  executiveStore: SqliteExecutiveStore;
  /** Passerelle de connecteurs — seul chemin vers un outil externe. */
  gateway: ConnectorGateway;
  connectors: ConnectorRegistry;
  /** "anthropic" si ANTHROPIC_API_KEY est configurée, "fallback" sinon. */
  modelMode: "anthropic" | "fallback";
  /** Nombre d'agents fabriqués par la Factory rechargés au démarrage. */
  publishedAgentCount: number;
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

  // ---- Couche objectifs ------------------------------------------------
  // Partage la connexion SQLite du socle plutôt que d'en ouvrir une
  // seconde sur le même fichier (voir SqliteRuntimeStore.connection).
  const goalStore = new SqliteGoalStore(store.connection);
  const skills = new SkillRegistry(skillRepositoryOf(goalStore));
  const executive = new ExecutiveEngine(registry, skills, decisionSinkOf(goalStore));
  const factory = new AgentFactory(model, publishedAgentStoreOf(goalStore));

  // Agents fabriqués par la Factory : rechargés au démarrage et
  // enregistrés comme n'importe quel agent du catalogue. C'est ce qui
  // rend un employé IA créé hier réellement opérationnel aujourd'hui.
  const published = loadPublishedAgents(goalStore, registry, model, store);

  // Connecteurs : enregistrés et exposés via la passerelle, qui applique
  // le RBAC et journalise chaque appel. Avant la réconciliation du
  // 29/07, ce package n'était importé nulle part — la garantie était
  // vraie sur le papier et câblée à rien.
  const connectors = new ConnectorRegistry();
  connectors.register(new GithubConnector());
  connectors.register(new StripeConnector());
  const gateway = new ConnectorGateway(connectors, authorization);

  // L'ingestion de métriques est un acteur système à part entière : elle
  // a son propre rôle RBAC, distinct des agents.
  for (const connector of connectors.list()) {
    for (const capability of connector.capabilities) {
      store.grantPermission({
        roleId: "metric-ingestion",
        capability: `${connector.id}.${capability.name}`,
        allowed: capability.riskLevel === "low",
        requiresHumanValidation: capability.riskLevel === "critical",
      });
    }
  }

  const goalEngine = new GoalEngine({
    objectives: objectiveStoreOf(goalStore),
    keyResults: keyResultStoreOf(goalStore),
    missions: missionStoreOf(goalStore),
    deliverables: deliverableStoreOf(goalStore),
    planner: new ModelPlanner(model, new PlaybookPlanner()),
    executive,
    // Le moteur d'objectifs délègue à l'Orchestrateur : un seul chemin
    // de routage pour tout le système (réconciliation du 29/07).
    runner: orchestrator,
    skills,
    validator: new DeliverableValidator(model),
    memory,
  });

  // ---- Étage exécutif ---------------------------------------------------
  const executiveStore = new SqliteExecutiveStore(store.connection);
  const metrics = new MetricRegistry(executiveStore);
  const humanBrain = new HumanBrain(executiveStore);

  // Seules les métriques réellement calculables depuis l'état interne
  // sont alimentées. Toutes les autres restent « non mesurées » tant
  // qu'un connecteur externe ne les remplit pas — voir @gc-ai-os/metrics.
  refreshDerivedMetrics(goalStore, executiveStore);

  return {
    orchestrator,
    store,
    goalStore,
    goalEngine,
    executive,
    skills,
    factory,
    agents: registry,
    metrics,
    humanBrain,
    executiveStore,
    gateway,
    connectors,
    modelMode: model.mode,
    publishedAgentCount: published,
  };
}

/**
 * Alimente les métriques que GC AI OS peut mesurer sur lui-même, sans
 * connecteur externe : activité opérationnelle et fiabilité des agents.
 *
 * C'est délibérément le seul endroit où des métriques sont écrites au
 * démarrage. Tout ce qui vient de Stripe, Supabase, GitHub ou des
 * réseaux sociaux reste vide et visible comme tel — le tableau de bord
 * doit montrer ce qui manque, pas le combler.
 */
function refreshDerivedMetrics(goalStore: SqliteGoalStore, executiveStore: SqliteExecutiveStore): void {
  const stats = goalStore.operationalStats();
  const now = new Date().toISOString();

  const write = (metricId: string, value: number) => {
    void executiveStore.record({ metricId, value, source: "derived", measuredAt: now });
  };

  write("missions_completed", stats.missionsCompleted);
  write("missions_blocked", stats.missionsFailed);
  write("pending_validations", stats.missionsAwaitingValidation);

  if (stats.skillRuns > 0) {
    write("agent_success_rate", Math.round((stats.skillSuccesses / stats.skillRuns) * 100));
  }
}

/**
 * Recharge les agents publiés par la Factory. Les échecs
 * d'enregistrement (domaine devenu conflictuel, manifeste écrit par une
 * version antérieure du schéma) sont ignorés agent par agent : un
 * blueprint devenu invalide ne doit pas empêcher tout le système de
 * démarrer.
 */
function loadPublishedAgents(
  goalStore: SqliteGoalStore,
  registry: AgentRegistry,
  model: ReturnType<typeof createModelProvider>,
  store: SqliteRuntimeStore,
): number {
  let loaded = 0;

  for (const published of goalStore.listPublishedSync()) {
    try {
      registry.register(new DeclarativeAgent(published.blueprint, model));
      store.grantPermission({
        roleId: published.blueprint.id,
        capability: `${published.blueprint.id}.converse`,
        allowed: true,
        requiresHumanValidation: false,
      });
      loaded += 1;
    } catch {
      // Agent ignoré : voir la table published_agents pour diagnostiquer.
    }
  }

  return loaded;
}

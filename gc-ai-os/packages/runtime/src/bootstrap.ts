import { AgentRegistry } from "@gc-ai-os/agents-core";
import { CtoAgent } from "@gc-ai-os/cto-agent";
import { DevopsAgent } from "@gc-ai-os/devops-agent";
import { MemoryClient } from "@gc-ai-os/memory";
import { createModelProvider } from "@gc-ai-os/model-provider";
import { KeywordDomainClassifier, Orchestrator } from "@gc-ai-os/orchestrator";
import { AuthorizationService } from "@gc-ai-os/security";
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
 * phase 1) : enregistre les agents disponibles, initialise le RBAC avec
 * uniquement la capacité "converser" accordée à chacun (deny-by-default
 * pour tout le reste, voir docs/gc-ai-os/06-securite.md), et construit
 * l'Orchestrateur branché sur le store SQLite.
 */
export function bootstrapRuntime(dbPath: string): GcRuntime {
  const store = new SqliteRuntimeStore(dbPath);
  const model = createModelProvider();

  const registry = new AgentRegistry();
  registry.register(new CtoAgent(model));
  registry.register(new DevopsAgent(model));

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

  const classifier = new KeywordDomainClassifier([
    {
      domain: "infrastructure",
      pattern: /d[ée]ploi|infra|serveur|ci\/cd|pipeline|netlify|vercel|h[ée]bergement/i,
    },
  ]);

  const orchestrator = new Orchestrator(registry, store, {
    classifier,
    authorization,
    memory,
  });

  return { orchestrator, store, modelMode: model.mode };
}

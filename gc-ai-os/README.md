# gc-ai-os

Scaffold technique de GC AI OS — Orchestrateur et agents IA spécialisés
pilotant Génération Capable. Fondation de GC AI Factory.

La documentation d'architecture (vision, décisions, comparatifs justifiés)
vit dans le repository `-generation-capable`, sous `docs/gc-ai-os/`. Ce
scaffold en est l'implémentation initiale de phase 1 (voir
`docs/gc-ai-os/09-roadmap.md` dans ce même repository) — toute divergence
entre ce code et la documentation d'architecture doit être résolue en
mettant l'un ou l'autre à jour explicitement, jamais laissée en silence.

## Structure

```
apps/
  web/                 # Dashboard Next.js (voir docs 07-interface.md)
packages/
  shared-types/         # Types partagés : Agent, Task, Connector, mémoire, sécurité
  agents-core/           # Interface Agent (BaseAgent) et registre d'agents
  agents/
    cto-agent/            # Squelette : revue d'architecture
    devops-agent/          # Squelette : CI/CD et déploiement
  connectors/             # ConnectorGateway (point de passage RBAC obligatoire) + connecteurs
  memory/                  # Client de mémoire versionnée + recherche sémantique
  security/                 # AuthorizationService (RBAC deny-by-default) + audit
supabase/
  migrations/                # Schéma initial : tasks, memory_entries, decisions, audit_log, role_permissions
```

Chaque `packages/agents/<nom>-agent` dépend de `agents-core` et
`connectors`, jamais l'inverse — un agent doit pouvoir être supprimé ou
remplacé sans casser le reste du système.

## Ce qui est implémenté dans ce squelette de phase 1

- Les contrats (types partagés) pour Agent, Task, Connector, mémoire,
  permissions.
- `AuthorizationService` : RBAC deny-by-default + journal d'audit, point
  de passage obligé avant toute exécution de capacité de connecteur.
- `ConnectorGateway` : seul point d'entrée par lequel un agent invoque un
  connecteur — impossible à contourner par erreur de code dans un agent.
- `Orchestrator` : router (par domaine, ambiguïté = escalade), planner
  (décomposition en sous-tâches), superviseur (dispatch + persistance de
  résultat).
- `MemoryClient` : écriture versionnée (jamais d'édition en place),
  recherche sémantique par embedding.
- Deux agents squelettes (`CtoAgent`, `DevopsAgent`) illustrant le
  contrat `Agent`, sans logique métier réelle — leurs `execute()`
  retournent `escalated` explicitement plutôt que de simuler un travail
  non fait.
- Migration Supabase initiale avec RLS activée sans politique permissive
  (deny-by-default également au niveau base de données).

## Ce qui n'est pas encore implémenté (volontairement, hors scope de ce
scaffold d'architecture)

- Implémentation réelle des connecteurs (GitHub, Stripe, etc.) au-delà du
  squelette `GithubConnector`.
- Logique métier réelle des agents.
- Politiques RLS par rôle (actuellement RLS activée mais aucune politique
  n'accorde d'accès — à définir avec le RBAC applicatif de
  `packages/security`).
- Wiring du dashboard `apps/web` sur des données Supabase réelles.

## Démarrer

```bash
pnpm install
pnpm build
pnpm dev
```

Nécessite `pnpm` ≥ 9 et Node ≥ 20. Voir `.env.example` pour les variables
d'environnement attendues (Supabase, modèles LLM, connecteurs).

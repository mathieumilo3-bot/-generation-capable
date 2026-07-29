# gc-ai-os

GC AI OS — Orchestrateur et agents IA spécialisés pilotant Génération
Capable. Fondation de GC AI Factory.

La documentation d'architecture (vision, décisions, comparatifs justifiés)
vit dans le repository `-generation-capable`, sous `docs/gc-ai-os/`. Ce
dossier en est l'implémentation de phase 1 (voir
`docs/gc-ai-os/09-roadmap.md`) — toute divergence entre ce code et la
documentation d'architecture doit être résolue en mettant l'un ou l'autre
à jour explicitement, jamais laissée en silence.

**État réel, pas une promesse** : ce n'est pas une maquette. Le chat
fonctionne de bout en bout — routage, RBAC, audit, mémoire — dès
`pnpm install && pnpm dev`, sans aucune configuration. Ce qui est simulé
(la génération de texte, tant qu'aucune clé de modèle n'est fournie) est
annoncé comme tel par l'application elle-même, jamais présenté comme réel
quand il ne l'est pas.

## Démarrer

```bash
cd apps/web
pnpm install
pnpm dev
```

Ouvrir <http://localhost:3000>. C'est tout — aucune base de données à
provisionner, aucun service externe à configurer. Un fichier
`apps/web/.data/gc-ai-os.sqlite` est créé automatiquement au premier
démarrage (persistance locale, voir plus bas).

### Activer les vraies réponses des agents

Sans clé de modèle, le chat répond en mode démonstration hors-ligne et le
dit explicitement — le routage, la vérification RBAC et la journalisation
d'audit tournent quand même réellement. Pour obtenir de vraies réponses
générées par un modèle :

```bash
cp apps/web/.env.example apps/web/.env.local
# éditer apps/web/.env.local et renseigner ANTHROPIC_API_KEY
pnpm dev
```

## Structure

```
apps/
  web/                     # Interface de chat Next.js + API /api/chat
packages/
  shared-types/             # Types partagés : Agent, Task, Connector, mémoire, sécurité
  model-provider/            # Couche modèle : AnthropicModelProvider + FallbackModelProvider
  agents-core/                # BaseAgent, ConversationalAgent, registre d'agents
  agents/
    cto-agent/                  # Conversationnel : questions d'architecture, revue, standards
    devops-agent/                 # Conversationnel : CI/CD, déploiement, infra
  connectors/                       # ConnectorGateway (point de passage RBAC obligatoire) + connecteurs
  memory/                            # Client de mémoire versionnée + recherche sémantique
  security/                           # AuthorizationService (RBAC deny-by-default) + audit
  runtime/                              # Assemblage : store SQLite local + bootstrap de l'Orchestrateur
supabase/
  migrations/                           # Schéma de référence (même forme que le store SQLite local)
```

Chaque `packages/agents/<nom>-agent` dépend de `agents-core` et
`model-provider`, jamais l'inverse — un agent doit pouvoir être supprimé
ou remplacé sans casser le reste du système.

## Ce qui tourne réellement aujourd'hui

- **Chat** : chaque message passe par l'Orchestrateur, qui route vers le
  CTO Agent ou le DevOps Agent selon des mots-clés (routage par domaine,
  voir `packages/orchestrator/src/domain-classifier.ts`), vérifie la
  permission via `AuthorizationService` (deny-by-default, capacité
  `<agent>.converse`), fait générer une réponse (Anthropic si une clé est
  fournie, sinon un message honnête de démonstration), journalise le tour
  dans `audit_log`, et écrit un résumé dans `memory_entries`.
- **Sécurité active, pas décorative** : demander une action critique
  (« déploie ça en prod ») déclenche un refus explicite de l'agent
  DevOps plutôt qu'une simulation d'action — vérifié par un test manuel
  réel avant ce commit.
- **Persistance locale réelle** (`packages/runtime`, SQLite via
  `node:sqlite`, sans dépendance externe) : tâches, permissions, journal
  d'audit et mémoire survivent à un redémarrage. Migrer vers Supabase
  Postgres (voir `supabase/migrations/0001_init.sql`, même structure)
  consiste à écrire une autre implémentation des mêmes interfaces
  (`TaskStore`, `PermissionStore`, `AuditSink`, `MemoryRepository`), pas
  à changer l'Orchestrateur ou les agents.

## Ce qui n'est pas encore implémenté

- Connecteurs réels au-delà du squelette `GithubConnector` (aucun appel
  externe n'est fait — GitHub, Stripe, etc. restent à connecter).
- Les 17 autres agents du catalogue (voir
  `docs/gc-ai-os/03-agents.md`) — seuls CTO et DevOps existent.
- Classification de domaine par modèle plutôt que par mots-clés
  (suffisant tant qu'il n'y a que deux agents, voir le commentaire dans
  `domain-classifier.ts`).
- Vues Agents/Mémoire/Workflows/Outils/Monitoring/Logs/Performances du
  dashboard (voir `docs/gc-ai-os/07-interface.md`) — seule la vue Chat
  existe pour l'instant.
- Adaptateur Supabase réel pour `TaskStore`/`MemoryRepository`/etc.
  (aujourd'hui uniquement le store SQLite local).

## Vérifié avant ce commit

`pnpm install`, `tsc --noEmit` sur tous les packages, `next build`, puis
`next start` avec des appels réels à `/api/chat` (routage CTO, routage
DevOps par mot-clé, escalade sur demande de déploiement) et inspection
directe du fichier SQLite pour confirmer l'écriture des tâches, du
journal d'audit et de la mémoire.

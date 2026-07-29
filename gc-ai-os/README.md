# gc-ai-os

GC AI OS — Orchestrateur et 19 agents IA spécialisés pilotant Génération
Capable. Fondation de GC AI Factory.

La documentation d'architecture (vision, décisions, comparatifs justifiés)
vit dans le repository `-generation-capable`, sous `docs/gc-ai-os/`. Ce
dossier en est l'implémentation de phase 1 (voir
`docs/gc-ai-os/09-roadmap.md`) — toute divergence entre ce code et la
documentation d'architecture doit être résolue en mettant l'un ou l'autre
à jour explicitement, jamais laissée en silence.

**État réel, pas une promesse** : ce n'est pas une maquette. Le chat
fonctionne de bout en bout — routage vers l'un des 19 agents, RBAC, audit,
mémoire — dès `pnpm install && pnpm dev`, sans aucune configuration. Ce
qui est simulé (la génération de texte, tant qu'aucune clé de modèle
n'est fournie) est annoncé comme tel par l'application elle-même, jamais
présenté comme réel quand il ne l'est pas.

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

## Les 19 agents

CEO (généraliste, domaine par défaut), CTO, Frontend, Backend, Supabase,
DevOps, QA, Marketing, Commercial, Support, Finance, Content, Research,
Data, Legal & Compliance, Automation, Security, Customer Success,
Recruitment — un package par agent sous `packages/agents/`, chacun
conversationnel dès aujourd'hui (voir `docs/gc-ai-os/03-agents.md` pour
le rôle et les responsabilités détaillés de chacun).

Chaque agent connaît le contexte réel de Génération Capable
(`packages/agents-core/src/business-context.ts`, extrait des fichiers de
production fournis : `index.html`, `ai-proxy.js`, `ambassador-data.js`) —
modèle Académie gratuite + abonnement Pro à 67 €/mois, commissions
vendeurs/ambassadeurs, standard de coaching du GC Cognitive Engine™
existant. Il lui est explicitement interdit d'inventer un chiffre ou une
fonctionnalité hors de ce contexte.

## Structure

```
apps/
  web/                     # Interface de chat Next.js + API /api/chat
packages/
  shared-types/             # Types partagés : Agent, Task, Connector, mémoire, sécurité
  model-provider/            # Couche modèle : AnthropicModelProvider + FallbackModelProvider
  agents-core/                # BaseAgent, ConversationalAgent, contexte métier, registre d'agents
  agents/                       # Un package par agent — voir "Les 19 agents" ci-dessus
    ceo-agent/  cto-agent/  frontend-agent/  backend-agent/  supabase-agent/
    devops-agent/  qa-agent/  marketing-agent/  commercial-agent/  support-agent/
    finance-agent/  content-agent/  research-agent/  data-agent/  legal-agent/
    automation-agent/  security-agent/  customer-success-agent/  recruitment-agent/
  connectors/                    # ConnectorGateway (point de passage RBAC obligatoire) + GitHub, Stripe
  memory/                          # Client de mémoire versionnée + recherche sémantique
  security/                          # AuthorizationService (RBAC deny-by-default) + audit
  orchestrator/                        # Router (mots-clés) / planner / superviseur / handleMessage
  runtime/                               # Assemblage : store SQLite local + bootstrap de l'Orchestrateur
supabase/
  migrations/                             # Schéma de référence (même forme que le store SQLite local)
```

Chaque `packages/agents/<nom>-agent` dépend de `agents-core` et
`model-provider`, jamais l'inverse — un agent doit pouvoir être supprimé
ou remplacé sans casser le reste du système.

## Ce qui tourne réellement aujourd'hui

- **Chat** : chaque message passe par l'Orchestrateur, qui route vers l'un
  des 19 agents selon des mots-clés (routage par domaine, voir
  `packages/runtime/src/bootstrap.ts` — CEO Agent est le domaine par
  défaut si aucun mot-clé plus spécifique ne correspond), vérifie la
  permission via `AuthorizationService` (deny-by-default, capacité
  `<agent>.converse`), fait générer une réponse (Anthropic si une clé est
  fournie, sinon un message honnête de démonstration), journalise le tour
  dans `audit_log`, et écrit un résumé dans `memory_entries`.
- **Sécurité active, pas décorative** : demander une action critique
  (« déploie ça en prod », « rembourse le client », « signe le contrat »)
  déclenche un refus explicite de l'agent concerné plutôt qu'une
  simulation d'action — chaque agent déclare ses propres motifs d'action
  critique (`criticalPatterns`).
- **Persistance locale réelle** (`packages/runtime`, SQLite via
  `node:sqlite`, sans dépendance externe) : tâches, permissions (19
  lignes RBAC, une par agent), journal d'audit et mémoire survivent à un
  redémarrage. Migrer vers Supabase Postgres (voir
  `supabase/migrations/0001_init.sql`, même structure) consiste à écrire
  une autre implémentation des mêmes interfaces (`TaskStore`,
  `PermissionStore`, `AuditSink`, `MemoryRepository`), pas à changer
  l'Orchestrateur ou les agents.

## Ce qui n'est pas encore implémenté

- Connecteurs réels au-delà des squelettes `GithubConnector` /
  `StripeConnector` (capacités déclarées, aucun appel externe n'est fait).
- Classification de domaine par modèle plutôt que par mots-clés — la
  règle par mot-clé est une approximation phase 1, documentée comme
  telle dans `bootstrap.ts` (ex. deux domaines proches peuvent se
  chevaucher sur un message ambigu).
- Vues Agents/Mémoire/Workflows/Outils/Monitoring/Logs/Performances du
  dashboard (voir `docs/gc-ai-os/07-interface.md`) — seule la vue Chat
  existe pour l'instant.
- Adaptateur Supabase réel pour `TaskStore`/`MemoryRepository`/etc.
  (aujourd'hui uniquement le store SQLite local).
- Peuplement complet de la mémoire métier (le contexte métier actuel est
  un socle codé en dur dans le prompt système, pas encore une mémoire
  versionnée et enrichissable — voir `docs/gc-ai-os/04-memoire.md`).

## Vérifié avant ce commit

`pnpm install`, `tsc --noEmit` sur les 27 packages (dont les 19 agents),
`next build`, puis `next start` avec des appels réels à `/api/chat` sur
huit domaines différents (défaut CEO, marketing, commercial, finance,
legal, security, recruitment, supabase — tous routés vers le bon agent),
plus deux escalades critiques vérifiées (« rembourse le client » →
Finance Agent refuse, « signe le contrat » → Legal Agent refuse) et
inspection directe du fichier SQLite pour confirmer les 19 lignes RBAC et
l'écriture réelle des tâches/audit/mémoire. Un bug de routage a été
trouvé et corrigé pendant cette vérification (le mot-clé finance ne
matchait que « remboursement », pas le verbe « rembourse »).

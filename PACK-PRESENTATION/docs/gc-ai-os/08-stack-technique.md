# 08 — Stack technique

## Choix retenus

| Couche | Choix | Justification courte |
|---|---|---|
| Langage | TypeScript strict | Un seul langage front/back/agents, typage fort pour un système où la correction des permissions et des contrats de données est critique |
| Frontend / Dashboard | Next.js (App Router) | SSR/streaming pour le dashboard temps réel, écosystème React mature, déploiement Vercel/Netlify natif |
| Backend / API | Next.js API routes + services TypeScript dédiés pour l'Orchestrateur | Évite une deuxième stack backend au démarrage ; l'Orchestrateur et les agents comme services TS indépendants dès que la charge le justifie |
| Base de données | Supabase (PostgreSQL) | Postgres relationnel + pgvector (recherche sémantique) + RLS (permissions au niveau ligne, aligné avec le RBAC) + Edge Functions, un seul fournisseur pour DB/auth/fonctions |
| Recherche sémantique | pgvector (extension Supabase) | Pas de base vectorielle séparée à opérer tant que le volume ne le justifie pas — cohérent avec KISS |
| Auth | Supabase Auth | Intégré à la base de permissions, RLS directement exploitable |
| Orchestration LLM | Couche modèle interne (voir 05-connecteurs.md) au-dessus d'Anthropic/OpenAI/OpenRouter | Portabilité de modèle par agent, pas de verrouillage fournisseur |
| CI/CD | GitHub Actions | Déjà le système de version cible, intégration native avec les vues PR/checks |
| Déploiement | Vercel (dashboard) / Netlify (sites statiques existants) | Cohérent avec l'infra actuelle de Génération Capable (`netlify.toml` existant) |
| Tests | Vitest (unitaire/intégration) + Playwright (E2E) | Rapide, typé, standard de l'écosystème TS moderne |
| Monorepo | pnpm workspaces + Turborepo | Partage de types entre Orchestrateur/agents/dashboard sans dupliquer, builds incrémentaux |

## Comparatifs pour les décisions structurantes

### Frontend : Next.js vs. alternative SPA (Vite + React Router)

| | Next.js | Vite + React Router |
|---|---|---|
| Avantages | SSR/streaming pour dashboard temps réel, API routes intégrées, déploiement Vercel natif | Build plus simple, moins de « magie » |
| Inconvénients | Plus de conventions à respecter | Nécessite un backend séparé dès le départ pour les API |
| **Retenu** | **Next.js** | — |

Justification : le dashboard doit afficher des données temps réel
(tâches en cours, validations en attente) — le rendu serveur et les
routes API intégrées de Next.js évitent de maintenir un service backend
minimal séparé uniquement pour le dashboard, sans empêcher l'extraction
de l'Orchestrateur en service indépendant plus tard.

### Orchestration d'agents : framework existant (LangGraph/CrewAI) vs. Orchestrateur maison

| | Framework existant | Orchestrateur maison (retenu) |
|---|---|---|
| Avantages | Démarrage plus rapide, patterns éprouvés | Contrôle total sur le modèle de permissions/audit (non négociable, voir 06), pas de dépendance à l'évolution/l'abandon d'un framework tiers, intégration native avec le schéma de mémoire Supabase |
| Inconvénients | Réinvente une partie de la roue, plus de code à maintenir au départ | Plus de travail initial |
| **Retenu** | — | **Orchestrateur maison**, en s'inspirant des patterns (graphe de tâches, state machine) sans dépendance dure |

Justification : les exigences de sécurité (Zero Trust, RBAC au niveau
capacité, audit immuable — voir 06) sont plus faciles à garantir dans un
Orchestrateur conçu pour elles dès le départ que retrofittées sur un
framework généraliste. Les patterns d'orchestration (graphe de tâches,
state machine) sont bien documentés et réimplémentables sans la
dépendance complète au framework.

### Base de données vectorielle : service dédié (Pinecone/Weaviate) vs. pgvector

| | Service dédié | pgvector (retenu) |
|---|---|---|
| Avantages | Optimisé spécifiquement pour la recherche vectorielle à très grande échelle | Un seul système à opérer, transactions cohérentes avec les données relationnelles (une tâche et son embedding dans la même transaction), coût nul supplémentaire (déjà sur Supabase) |
| Inconvénients | Système supplémentaire à opérer et sécuriser, latence réseau additionnelle | Moins performant à très grande échelle (millions d'embeddings) |
| **Retenu** | — | **pgvector**, réévaluer si le volume de mémoire dépasse l'échelle confortable de Postgres |

## Structure du monorepo (`gc-ai-os`)

```
gc-ai-os/
├── apps/
│   └── web/                 # Dashboard Next.js (interface, voir 07)
├── packages/
│   ├── orchestrator/        # Router, Planner, Superviseur
│   ├── agents-core/         # Interface Agent, registre d'agents
│   ├── agents/               # Un module par agent (cto-agent, devops-agent, ...)
│   ├── connectors/           # Un module par connecteur (github, supabase, stripe, ...)
│   ├── memory/                # Client de mémoire (structuré + recherche sémantique)
│   ├── security/              # RBAC, audit, politiques de validation
│   └── shared-types/          # Types TypeScript partagés (Agent, Task, Capability...)
├── supabase/
│   └── migrations/            # Schéma versionné (tasks, memory_entries, audit_log, ...)
├── docs/                      # ADR techniques locales au code (complète, ne remplace pas
│                               # le dossier docs/gc-ai-os/ du repo -generation-capable)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

Chaque `packages/agents/<nom>-agent` dépend de `agents-core` et
`connectors`, jamais l'inverse — garantit qu'un agent peut être supprimé
ou remplacé sans casser le reste du système (principe de modularité, 01).

## Qualité — appliqué concrètement

- **TypeScript strict** (`strict: true`, pas de `any` non justifié) sur
  tout le monorepo.
- **ESLint + Prettier** partagés via une configuration unique à la racine.
- **Tests obligatoires** avant merge : QA Agent bloque la PR si la
  couverture des fichiers modifiés régresse ou si les tests échouent
  (voir 03-agents.md).
- **Revue d'architecture** par le CTO Agent avant toute PR touchant à
  `orchestrator/`, `security/` ou au schéma Supabase.

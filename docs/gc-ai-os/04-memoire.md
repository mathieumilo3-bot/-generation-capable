# 04 — Architecture de mémoire

La mémoire est un actif de premier ordre (voir principe 4, 01). Elle doit
survivre au remplacement de n'importe quel agent ou modèle sous-jacent :
elle vit en base de données, jamais uniquement dans le contexte d'une
conversation.

## Les couches de mémoire

| Couche | Portée | Exemples de contenu | Qui écrit |
|---|---|---|---|
| **Globale** | Toute l'organisation | Vision, valeurs, règles commerciales, décisions structurantes | CEO/CTO Agents, validé humain pour les changements majeurs |
| **Projet** | Un projet/produit donné | État d'avancement, décisions de scope, historique du projet | Agents impliqués sur le projet |
| **Agent** | Privée à un agent | Contexte opérationnel propre (ex. préférences de style de code du Backend Agent) | L'agent lui-même |
| **Technique** | Système/infra | Schéma DB, architecture, ADR, dette technique | CTO, Supabase, DevOps, Security Agents |
| **Métier** | Connaissance Génération Capable | Produits, rôles, vendeurs, ambassadeurs, scripts, formations, procédures | Content, Commercial, Marketing, Legal Agents |
| **Historique des décisions** | Transverse | Qui a décidé quoi, pourquoi, quand — format ADR-like | Tout agent prenant une décision structurante |
| **Historique des conversations** | Transverse | Échanges humain↔agent et agent↔agent liés à une tâche | Système (automatique, lié à `task_id`) |
| **Documentation vivante** | Transverse | Docs qui se mettent à jour avec le système (ce dossier en est un exemple) | Agents concernés, en fin de tâche |

## Principe de séparation

Chaque couche a un **scope d'accès** différent :

- Un agent peut toujours écrire dans sa mémoire privée.
- L'accès en lecture/écriture aux couches globale, projet, technique et
  métier est gouverné par le RBAC (voir 06-securite.md) : un agent lit ce
  qui est pertinent à son domaine, pas l'intégralité du système par
  défaut.
- La mémoire globale n'est modifiable en écriture directe que par un
  nombre restreint d'agents (CEO, CTO) — les autres agents *proposent*
  une mise à jour, validée avant intégration, pour éviter la dérive
  incontrôlée de la connaissance partagée.

## Modèle de stockage

Deux familles de stockage, complémentaires plutôt qu'en concurrence :

1. **Stockage structuré (PostgreSQL / Supabase)** — pour tout ce qui a une
   structure claire : décisions (ADR), tâches, événements, métadonnées de
   projet, permissions. Interrogeable, joignable, contraint par schéma.

2. **Recherche sémantique (pgvector sur Supabase)** — pour la recherche
   par similarité sur du texte non structuré : documentation, transcripts
   de conversation, contenu métier. Chaque entrée de mémoire non
   structurée est indexée avec un embedding, ce qui permet à un agent de
   retrouver « ce qui est pertinent » sans connaître la référence exacte.

Schéma de haut niveau (détaillé et versionné dans le repo `gc-ai-os` sous
forme de migrations Supabase) :

```
memory_entries
  id, scope (global|project|agent|technical|business),
  project_id (nullable), agent_id (nullable),
  title, content, embedding (vector),
  created_by, created_at, version, superseded_by (nullable)

decisions
  id, title, context, decision, consequences,
  scope, related_task_id, decided_by, decided_at

conversations
  id, task_id, agent_id, role, content, created_at

tasks
  id, title, status, assigned_agent_id, parent_task_id,
  risk_level, created_at, updated_at, closed_at
```

## Versionnement

Aucune entrée de mémoire n'est éditée en place silencieusement :

- Une mise à jour crée une nouvelle version et marque l'ancienne comme
  `superseded_by`. L'historique complet reste consultable.
- Les décisions (`decisions`) ne sont jamais supprimées, seulement
  complétées par une décision ultérieure qui les révise explicitement
  (traçabilité façon ADR).

Cela permet à tout agent — ou humain — de répondre à « pourquoi cette
règle existe » et « qu'est-ce qui a changé depuis » sans reconstituer
l'historique depuis des conversations éparses.

## Apprentissage continu

Après la clôture de chaque tâche (voir cycle de vie, 02) :

1. L'agent responsable résume ce qui a été fait, ce qui a marché, ce qui
   a été corrigé en cours de route.
2. Ce résumé est écrit dans la mémoire projet/technique/métier
   appropriée, avec embedding pour recherche sémantique future.
3. Si la tâche a révélé un écart entre la documentation vivante et la
   réalité, l'agent propose une mise à jour de la documentation
   correspondante — la documentation ne doit jamais rester en désaccord
   silencieux avec le système réel.

Ce mécanisme est ce qui distingue GC AI OS d'un simple outil sans état :
chaque tâche rend le système un peu plus informé pour la suivante.

## Connaissance Génération Capable

La mémoire métier est initialisée avec la connaissance actuelle de
l'entreprise (vision, mission, valeurs, produits, rôles, vendeurs,
ambassadeurs, scripts, formations, procédures, règles commerciales et
techniques). C'est un chantier de *peuplement initial* distinct du
chantier d'*architecture* décrit ici : il consiste à structurer et
importer les documents existants (ex. contenu de `ambassadors.html`,
scripts commerciaux actuels) dans `memory_entries` avec le bon `scope`.

## Ce qui n'est pas retenu

- **Mémoire uniquement en contexte de conversation (pas de persistance)**
  — rejeté : perd tout à chaque redémarrage, impossible à auditer, ne
  permet pas l'apprentissage continu.
- **Un unique vecteur de mémoire sans scope** — rejeté : rend impossible
  un contrôle d'accès par domaine et mélange connaissance stratégique et
  détails opérationnels, ce qui dégrade la pertinence de la recherche
  sémantique avec l'échelle.

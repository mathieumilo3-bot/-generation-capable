# 02 — Architecture globale

## Vue d'ensemble

```
                    ┌─────────────────────────────┐
                    │        INTERFACE            │
                    │  Dashboard · Chat · Vues     │
                    └───────────────┬──────────────┘
                                    │
                    ┌───────────────▼──────────────┐
                    │        ORCHESTRATEUR          │
                    │  Router · Planner · Superviseur│
                    └───────────────┬──────────────┘
                                    │
      ┌──────────────┬─────────────┼─────────────┬──────────────┐
      ▼              ▼             ▼             ▼              ▼
  CEO Agent     CTO Agent   Backend Agent   QA Agent   ... (19 agents)
      │              │             │             │              │
      └──────────────┴─────────────┴─────────────┴──────────────┘
                                    │
                    ┌───────────────▼──────────────┐
                    │      MÉMOIRE PARTAGÉE         │
                    │  Globale · Projet · Agent ·   │
                    │  Technique · Métier · Vector  │
                    └───────────────┬──────────────┘
                                    │
                    ┌───────────────▼──────────────┐
                    │   COUCHE CONNECTEURS          │
                    │  GitHub · Supabase · Stripe... │
                    └───────────────────────────────┘

     Traverse toutes les couches : SÉCURITÉ (Zero Trust, RBAC, audit)
```

## L'Orchestrateur

L'Orchestrateur est un agent au rôle particulier : il ne fait pas le
travail métier, il **décide qui le fait**. Trois responsabilités
distinctes, à ne pas mélanger dans une seule fonction :

1. **Router** — reçoit une demande (utilisateur, événement système,
   webhook, tâche planifiée) et détermine quel(s) agent(s) sont
   compétents. Le routage se fait par métadonnées de capacité déclarées
   par chaque agent (domaine, outils, permissions requises), pas par un
   grand prompt qui « devine ». Un routage ambigu doit être remonté à
   l'humain plutôt que résolu par une supposition.

2. **Planner** — pour une tâche complexe touchant plusieurs domaines,
   décompose en sous-tâches et construit un graphe de dépendances
   (ex. « ajouter une fonctionnalité de facturation » → Backend Agent
   crée l'API → Supabase Agent crée la migration → QA Agent écrit les
   tests → DevOps Agent déploie). Ce graphe est persisté, pas seulement
   tenu en mémoire de conversation, pour être auditable et reprenable.

3. **Superviseur** — suit l'exécution, gère les échecs (retry, escalade
   vers un agent différent, escalade vers l'humain), applique les
   politiques de validation avant qu'une action critique parte en
   production.

L'Orchestrateur **n'exécute jamais lui-même** d'action outillée (pas
d'appel direct à GitHub, Supabase, etc.). Cette séparation stricte évite
qu'il devienne un point de contournement des permissions par agent.

## Anatomie d'un agent

Chaque agent est une unité autonome définie par une déclaration explicite,
pas par un prompt improvisé :

```
Agent {
  id, nom, domaine
  rôle                 // description du mandat
  responsabilités[]     // ce qu'il a le droit / le devoir de faire
  outils[]              // connecteurs et fonctions qu'il peut invoquer
  permissions            // RBAC — voir 06-securite.md
  mémoire {
    scope: "agent"       // sa mémoire privée
    accès: "global+projet" // ce qu'il peut lire ailleurs
  }
  workflows[]            // séquences validées qu'il sait exécuter
  modèle                 // LLM utilisé, remplaçable indépendamment
  politique_validation    // quelles actions nécessitent confirmation humaine
}
```

Un agent peut déléguer une sous-tâche à un autre agent en passant par
l'Orchestrateur (jamais d'appel agent → agent en direct hors observation
de l'Orchestrateur), afin que toute délégation reste traçable dans le
graphe de tâches.

## Cycle de vie d'une tâche

1. **Réception** — une tâche arrive (utilisateur, cron, webhook GitHub,
   alerte monitoring...).
2. **Qualification** — l'Orchestrateur détermine le(s) agent(s)
   compétent(s) et le niveau de risque (voir Sécurité).
3. **Planification** — si multi-agent, décomposition en sous-tâches avec
   dépendances explicites.
4. **Analyse → Architecture → Plan** — l'agent assigné applique le
   workflow de développement (voir 01) avant d'agir, pour toute tâche
   non triviale.
5. **Exécution** — l'agent agit via ses outils, dans son sandbox de
   permissions.
6. **Validation** — tests automatiques puis, si l'action est classée
   critique, validation humaine explicite avant merge/déploiement.
7. **Documentation** — mise à jour de la mémoire (décision, résultat,
   documentation vivante).
8. **Clôture** — statut persisté, disponible pour audit et pour
   apprentissage continu (voir 04-memoire.md).

Chaque étape est un événement journalisé. Rien ne doit être « invisible »
entre la réception d'une tâche et sa clôture.

## Communication inter-agents

- **Bus d'événements** asynchrone (ex. table `agent_events` +
  souscriptions, ou file de messages) plutôt que des appels synchrones
  bloquants entre agents. Un agent publie un résultat ou une demande, un
  autre le consomme.
- Tout message inter-agents référence la tâche parente (`task_id`) pour
  que le graphe reste reconstructible.
- Les agents ne partagent pas de mémoire mutable en direct : ils lisent
  et écrivent dans la mémoire partagée via une API contrôlée par
  permissions, jamais par accès base de données direct depuis le code
  d'un agent.

## Pourquoi ce modèle plutôt que les alternatives

| Approche | Avantages | Inconvénients | Retenu ? |
|---|---|---|---|
| **Un seul agent généraliste** avec beaucoup d'outils | Simple à démarrer, pas de routage | Ne scale pas (prompt géant, permissions non isolées, un bug affecte tout), impossible à faire évoluer domaine par domaine indépendamment | Non |
| **Orchestrateur + agents spécialisés** (retenu) | Modulaire, permissions isolées par domaine, agents remplaçables indépendamment, aligné avec l'organisation réelle de l'entreprise | Complexité de routage et de coordination à gérer explicitly | **Oui** |
| **Essaim d'agents pairs sans orchestrateur central** (ex. discussion libre multi-agents) | Flexible, pas de goulot d'étranglement | Difficile à auditer, comportement émergent imprévisible, dangereux pour des actions critiques en entreprise | Non |

Le choix « Orchestrateur + agents spécialisés » est celui qui correspond
le mieux à une exigence de traçabilité et de permissions fines dans un
contexte d'entreprise réelle — les essaims non supervisés sont adaptés à
la recherche, pas à un système qui touche à la production, aux finances
ou aux clients.

## Idempotence et reprise

Toute tâche doit pouvoir être interrompue et reprise sans effet de bord
(ex. crash de l'Orchestrateur en cours d'exécution). Cela implique :

- Les actions à effet de bord (déploiement, envoi d'email, écriture en
  base) sont journalisées *avant* exécution avec un identifiant
  d'idempotence, pour détecter et éviter les doubles exécutions au
  redémarrage.
- L'état d'une tâche est toujours dans la base de données (jamais
  uniquement en mémoire process), pour survivre à un redémarrage de
  service.

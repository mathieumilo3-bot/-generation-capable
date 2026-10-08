# 06 — Sécurité

La sécurité n'est pas une couche ajoutée après coup : elle conditionne des
choix faits dès l'architecture globale (l'Orchestrateur n'exécute jamais
d'action lui-même, les connecteurs sont le seul point d'appel outillé —
voir 02 et 05).

## Zero Trust

Aucun agent, aucun connecteur, aucun composant interne n'est considéré
digne de confiance par défaut :

- Chaque appel de capacité (voir 05-connecteurs.md) est vérifié contre le
  RBAC au moment de l'exécution, jamais uniquement au moment où l'agent a
  été configuré. Un changement de permission prend effet immédiatement.
- La confiance n'est jamais transitive : que le CTO Agent ait validé une
  architecture ne donne pas au Backend Agent le droit de déployer en
  production — chaque agent a ses propres permissions, évaluées
  indépendamment.
- Toute communication inter-service (agent → connecteur, service →
  service) est authentifiée, même en interne.

## RBAC (contrôle d'accès par rôle)

Modèle à trois niveaux :

1. **Rôle** — celui de l'agent (ex. `supabase_agent`, `finance_agent`).
2. **Capacité** — l'action précise (ex. `supabase.apply_migration`,
   `stripe.create_refund`).
3. **Niveau de risque** — `low` / `medium` / `high` / `critical`, déclaré
   par le connecteur (voir 05) et affinable par capacité.

```
role_permissions
  role_id, capability, allowed (bool), requires_human_validation (bool)

audit_log
  id, actor_agent_id, capability, params_hash, risk_level,
  decision (allowed|denied|escalated), executed_at, task_id
```

Règle par défaut : **deny by default**. Un agent n'a accès qu'aux
capacités explicitement listées pour son rôle — l'ajout d'un nouveau
connecteur ou d'une nouvelle capacité ne donne accès à personne tant
qu'une permission n'a pas été attribuée explicitement.

## Journal d'audit

Toute action passant par la couche connecteur est journalisée, y compris
les actions refusées (pour détecter les tentatives anormales). Le journal
est :

- **Immuable** — append-only, jamais modifié ni supprimé par un agent.
- **Consultable par le Security Agent** et par les humains via le
  dashboard (voir 07-interface.md).
- **Relié à la tâche d'origine** (`task_id`) pour reconstituer le
  contexte complet d'une action.

## Validation des actions critiques

Toute action classée `critical` (déploiement en production, migration de
schéma en prod, remboursement, envoi de communication engageante,
document légal, changement de permission RBAC lui-même) suit un circuit
de validation humaine avant exécution :

1. L'agent prépare l'action et la soumet (ex. PR ouverte, migration
   proposée, brouillon de remboursement).
2. L'action est mise en file d'attente de validation, visible dans le
   dashboard.
3. Un humain autorisé approuve ou rejette. Sans approbation explicite,
   l'action n'est jamais exécutée automatiquement, y compris après un
   délai — pas de « validation par défaut si personne ne répond ».
4. L'approbation et son auteur sont journalisés au même titre que
   l'action elle-même.

## Sandbox pour les actions risquées

Les actions à risque `medium`/`high` qui ne sont pas encore `critical`
(ex. exécution de code généré, test d'un nouveau workflow d'automatisation)
s'exécutent dans un environnement isolé avant toute exposition à des
données ou systèmes réels :

- Branches Git isolées + previews de déploiement pour le code, jamais de
  push direct sur la branche de production.
- Environnement Supabase de branche (branche de développement) pour
  tester une migration avant de l'appliquer en production.
- Workflow d'automatisation testé en mode simulation (dry-run) avant
  activation.

## Rollback automatique

Toute action à effet de bord réversible est accompagnée d'un plan de
retour arrière explicite avant exécution :

- Déploiement : conservation de la version précédente, retour arrière en
  un clic/une commande si le monitoring post-déploiement détecte une
  anomalie.
- Migration de base de données : migration down testée avant que la
  migration up soit appliquée en production.
- Automatisation : capacité de désactivation immédiate d'un workflow
  n8n/Make sans effet rétroactif sur les exécutions déjà terminées.

## Gestion des secrets

- Aucun secret (clé API, jeton OAuth) n'est stocké en clair dans le code,
  la mémoire de conversation, ou visible d'un agent sous forme brute.
- Les secrets sont détenus par la couche connecteurs (voir 05), injectés
  au moment de l'exécution, jamais exposés dans les prompts envoyés aux
  modèles.
- Rotation régulière et révocation immédiate possible sans redéploiement
  de code (secrets externalisés, pas compilés en dur).

## Chiffrement

- Chiffrement au repos pour toute donnée sensible en base (Supabase :
  chiffrement natif + colonnes sensibles chiffrées applicativement si
  nécessaire, ex. données personnelles clients).
- Chiffrement en transit systématique (TLS) pour tous les appels, y
  compris internes.

## Security Agent : rôle transverse

Le Security Agent (voir 03-agents.md) n'est pas seulement un agent parmi
d'autres : il a un accès en lecture au journal d'audit de tous les autres
agents et un mandat explicite d'alerter (jamais d'agir seul sur les
permissions d'un autre agent sans validation humaine — pour éviter qu'un
agent compromis ou en erreur ne puisse s'auto-accorder des droits via le
Security Agent).

## Ce qui n'est pas retenu

- **Permissions statiques codées en dur par agent** — rejeté : empêche
  tout ajustement fin sans redéploiement, contraire au principe
  d'extensibilité par convention.
- **Validation humaine uniquement a posteriori (post-hoc review)** pour
  les actions critiques — rejeté : le risque (ex. remboursement erroné,
  déploiement cassé en prod) est déjà matérialisé avant la revue, ce qui
  ne protège pas l'entreprise.

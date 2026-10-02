# 07 — Interface

## Principe

L'interface est une fenêtre de contrôle et d'observation sur un système
qui, par défaut, agit de façon autonome — pas un chat qui cache tout le
reste. Chaque vue correspond à une couche déjà décrite dans les documents
précédents ; l'interface n'introduit aucun concept qui n'existe pas déjà
dans le modèle de données.

## Vues

### Dashboard (vue d'accueil)
Synthèse : tâches actives, actions en attente de validation critique
(voir 06-securite.md), alertes du Security/DevOps Agent, coût modèle du
jour/mois. Objectif : un humain doit comprendre l'état de l'entreprise
pilotée par GC AI OS en moins de 30 secondes.

### Interface conversationnelle
Chat avec l'Orchestrateur (pas directement avec un agent isolé — c'est
l'Orchestrateur qui route, voir 02). L'historique est une vue sur la
couche `conversations` de la mémoire, donc consultable après coup comme
n'importe quelle autre trace.

### Vue Agents
Liste des 19 agents (et de tout agent ajouté ensuite) avec leur statut
(actif, en tâche, en attente de validation, désactivé), leurs
permissions courantes, et un lien vers leur mémoire privée. Permet
d'activer/désactiver un agent ou de modifier son modèle sans toucher au
code (voir modularité, 01).

### Vue Tâches
Le graphe de tâches et sous-tâches (voir cycle de vie, 02), avec statut,
agent assigné, niveau de risque, et — si applicable — position dans la
file de validation critique. Permet de suivre une tâche complexe
multi-agents de bout en bout.

### Vue Mémoire
Explorateur des couches de mémoire (globale, projet, agent, technique,
métier — voir 04), avec recherche sémantique et historique de versions.
C'est la vue qui rend la « documentation vivante » réellement navigable
par un humain, pas seulement par les agents.

### Vue Workflows
Liste des workflows validés par agent, avec leur statut (actif, en
sandbox/dry-run, désactivé) et leur historique d'exécution — couvre aussi
bien les workflows de développement internes que les automatisations
n8n/Make gérées par l'Automation Agent.

### Vue Outils (connecteurs)
État de chaque connecteur (voir 05) : connecté/déconnecté, capacités
exposées, quota/rate-limit restant, dernière erreur. Point d'entrée pour
ajouter ou reconfigurer un connecteur.

### Vue Monitoring
Santé du système : latence des agents, taux d'échec de tâche, coût par
agent/modèle, alertes actives. Distincte de la vue Logs : ici, l'objectif
est la tendance et l'anomalie, pas le détail événement par événement.

### Vue Logs
Journal d'audit brut (voir 06-securite.md), filtrable par agent,
capacité, niveau de risque, décision (autorisé/refusé/escaladé). Vue de
référence pour toute investigation ou audit de conformité.

### Vue Performances
Métriques d'exécution par agent et par workflow : taux de succès, temps
moyen de résolution de tâche, taux d'escalade humaine. Sert à décider
quels agents ou workflows nécessitent une amélioration — donnée d'entrée
du cycle d'apprentissage continu (voir 04-memoire.md).

## Cohérence transverse

- Toute action déclenchable depuis l'interface (approuver, désactiver un
  agent, relancer une tâche) passe par les mêmes chemins de permission
  que si elle était déclenchée par un agent — l'interface n'est pas un
  raccourci qui contourne le RBAC.
- Les vues sont des lectures sur le modèle de données décrit dans les
  documents 02/04/05/06 : aucune vue ne doit nécessiter une structure de
  données parallèle non documentée ailleurs.

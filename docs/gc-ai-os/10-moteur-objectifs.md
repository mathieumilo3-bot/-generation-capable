# 10 — Moteur d'objectifs

## Le changement de nature

Jusqu'ici, GC AI OS était **orienté conversation** : on lui parlait, il
répondait. C'est utile mais plafonné — chaque tour part de zéro, rien ne
se poursuit, et la valeur produite est du texte à l'écran.

Le moteur d'objectifs le rend **orienté objectifs** :

```
Objectif
   ↓  Planification (décomposition en missions)
   ↓  Affectation (Directeur Général — voir 13)
   ↓  Exécution parallèle (par vagues de dépendances)
   ↓  Auto-correction (critique réinjectée, nouvelle tentative)
   ↓  Validation (porte structurelle + jugement)
   ↓  Livraison (dossier téléchargeable)
```

Concrètement : au lieu de « développe cette page », on dit « amène
Génération Capable à 10 000 clients », et le système produit un plan, le
répartit entre agents, l'exécute, se corrige, et livre des fichiers.

## Ce qui rend l'autonomie acceptable

Un système qui travaille seul plusieurs jours est un risque financier et
opérationnel, pas seulement une prouesse technique. Trois garde-fous sont
donc structurels, pas optionnels :

1. **Budget dur** (`Objective.budgetMicros`). Vérifié avant chaque
   mission par le Directeur Général. À épuisement, l'exécution s'arrête
   et remonte à l'humain — le système ne peut pas s'auto-augmenter.
2. **Plafond de tentatives** (`Mission.maxAttempts`). L'auto-correction
   est bornée : après N échecs, la mission est abandonnée explicitement
   plutôt que réessayée indéfiniment.
3. **RBAC et escalade**. Une mission ne contourne pas les permissions
   parce qu'elle vient d'un objectif plutôt que d'un chat. Toute action
   critique est refusée et remontée, jamais simulée comme faite.

C'est le point le plus important de ce document : **la valeur défendable
n'est pas le planificateur, c'est la boucle de gouvernance autour du
planificateur.** Décomposer un objectif est facile ; le faire sans que
l'entreprise perde le contrôle des coûts, des accès et de la traçabilité
est le vrai problème.

## Planification : modèle ou playbook

| Approche | Avantages | Inconvénients | Retenu ? |
|---|---|---|---|
| **Modèle uniquement** | Décomposition fine, adaptée à n'importe quel objectif | Inutilisable sans clé API ; un modèle qui déraille bloque tout | Non seul |
| **Playbook déterministe uniquement** | Toujours disponible, reproductible | Générique, ne s'adapte pas à un objectif inhabituel | Non seul |
| **Modèle avec repli playbook** (retenu) | Qualité du modèle quand il est disponible, garantie de fonctionnement sinon | Deux chemins à maintenir | **Oui** |

`Plan.source` indique toujours lequel a produit le plan — on ne présente
jamais un plan générique comme une analyse sur mesure.

Le planificateur modèle nettoie les dépendances inconnues qu'un LLM peut
inventer : une référence vers une mission inexistante bloquerait la
mission pour toujours dans l'ordonnanceur.

## Exécution parallèle

L'ordonnanceur (`buildBatches`) construit des vagues : toutes les
missions dont les dépendances sont satisfaites partent ensemble via
`Promise.all`. Un cycle de dépendances lève une erreur explicite plutôt
que de boucler ou d'ignorer silencieusement des missions.

## Auto-correction

Une mission rejetée à la validation n'est pas simplement réessayée à
l'identique : la critique du validateur est **réinjectée dans le brief**
de la tentative suivante. L'agent sait donc précisément ce qui a été
reproché. Chaque rejet est écrit en mémoire avec le type `error`, ce qui
alimente l'apprentissage (voir 04).

## Validation

Deux niveaux séparés :

- **Structurel** (toujours) : livrable vide, tronqué, refus d'agent.
  Fiable, gratuit, attrape la majorité des échecs réels.
- **Qualitatif** (si modèle disponible) : le livrable satisfait-il
  vraiment le critère d'acceptation.

Si le modèle est absent, le système ne prétend pas avoir validé sur le
fond — la critique le dit explicitement.

## Livraison

Chaque mission réussie produit un `Deliverable` (Markdown) téléchargeable
individuellement. L'objectif entier produit un **dossier** assemblant
résultats-clés, plan, tous les livrables et la traçabilité des
arbitrages.

Format Markdown volontairement : lisible tel quel, versionnable,
convertible en PDF/Word/Notion sans ajouter de dépendance au projet.

## Limites assumées de la phase 1

- Le coût est forfaitaire par tentative, pas mesuré en tokens réels.
- Les résultats-clés ne sont pas encore alimentés automatiquement par des
  données de production (Stripe, Supabase) — leur valeur courante reste
  celle du départ tant qu'un connecteur ne les met pas à jour.
- L'exécution est déclenchée par requête HTTP ; un objectif « travaillant
  plusieurs jours » suppose un ordonnanceur persistant (chantier phase 2).

# 16 — Audit complet (29 juillet 2026)

Audit de tout ce qui a été promis depuis le premier jour, comparé à ce
qui tourne réellement. Chaque ligne a été vérifiée par une commande sur
le code, pas de mémoire.

**Verdict court** : le cœur est solide et réellement fonctionnel. Trois
écarts sérieux doivent être réglés avant d'ajouter quoi que ce soit —
zéro test, une passerelle de sécurité branchée sur rien, et une migration
Supabase qui a 9 tables de retard.

---

## ✅ Terminé et vérifié en fonctionnement

| Fonctionnalité | Preuve |
|---|---|
| 19 agents + 1 fabriqué | 20 agents servis par `/api/agents`, routage vérifié sur 8 domaines |
| Orchestrateur (routage, RBAC, audit, mémoire) | Chaque message journalisé, escalades critiques refusées en conditions réelles |
| Moteur d'objectifs bout en bout | Objectif « 10 000 clients » : 6 missions, 6 agents, 6 livrables, dossier téléchargé |
| Exécution parallèle par vagues | Ordonnanceur par dépendances, cycles détectés |
| Auto-correction + validation | Critique réinjectée, plafond de tentatives respecté |
| Livrables téléchargeables | En-têtes `content-disposition` corrects, fichiers réels |
| Directeur Général déterministe | Scores et alternatives persistés, décisions reconstituables |
| Télémétrie de compétences | 50 → 67 après un succès, conforme au lissage de Laplace |
| GC AI Factory | Agent fabriqué, évalué, publié, **vivant après redémarrage** |
| 8 Executive Brains + Decision Engine | Priorité bascule quand on injecte des données réelles |
| Enterprise Score honnête | « Non mesuré » affiché, note globale masquée sous 50 % de couverture |
| Human Brain + consentement | Escalade à 16 j, refus de personnaliser sans consentement |
| Persistance SQLite | 15 tables, survit au redémarrage |
| Build et typage | 35 packages `tsc --noEmit` propres, build production vert |

---

## 🟡 Présent mais incomplet

| Élément | Écart réel |
|---|---|
| **Recherche sémantique** | `LocalHashEmbeddingProvider` est un sac de mots haché. Deux phrases synonymes sans mot commun ne se rapprochent pas. Le pipeline fonctionne, la sémantique non. |
| **Interface** | 4 vues sur les 10 promises (doc 07). Manquent : Tâches, Mémoire, Workflows, Outils, Monitoring, Logs. |
| **Evaluator de la Factory** | Juge le *manifeste*, pas les réponses réelles d'un agent candidat. Un agent au mandat bien rédigé passe sans avoir jamais répondu. |
| **Métriques** | 3 alimentées sur 28. Les 25 autres attendent un connecteur. |
| **Planificateur modèle** | Fonctionne, mais jamais exercé — aucune clé n'a encore été configurée. Le chemin `source: "model"` n'a pas tourné une seule fois. |
| **Coût** | Forfaitaire (1 000 µ€/tentative), pas de tokens réels. Le budget protège, mais ne mesure pas. |

---

## ❌ Promis et absent

| Promesse | Où c'était écrit | État |
|---|---|---|
| **Tests automatisés** | 01, 08 (« Vitest + Playwright », « tests obligatoires avant merge ») | **0 fichier de test.** Rien ne protège contre une régression. |
| **CI/CD GitHub Actions** | 08, agent DevOps | **Aucun workflow.** |
| **ESLint + Prettier** | 08 (« configuration unique à la racine ») | **Aucune config.** |
| **Connecteurs réels** | 05 (18 connecteurs listés) | GitHub et Stripe déclarent des capacités, **aucun appel externe n'est fait**. |
| **Sandbox, rollback, gestion des secrets, chiffrement** | 06 | Documentés, **rien d'implémenté**. |
| **Historique de conversations** | 04 | Table `conversations` créée, **jamais écrite**. |
| **Décisions type ADR** | 04 | Table `decisions` créée, **jamais écrite** (les décisions vont dans `memory_entries`). |
| **Adaptateur Supabase** | 08, 10 | Rien. Uniquement SQLite local. |
| **Ordonnanceur persistant** | 10 | Un objectif ne peut pas « travailler plusieurs jours » — tout se joue dans une requête HTTP. |
| **Founder Operating Manual** | Demandé aujourd'hui | Pas encore construit. |

---

## ⚠️ À refactoriser avant d'aller plus loin

### 1. Le package `connectors` n'est importé par personne — GRAVE

```
grep ConnectorGateway → 1 seule occurrence, dans un commentaire
```

`ConnectorGateway` est décrit partout comme « le point de passage
obligatoire que le RBAC rend impossible à contourner ». **Il n'est câblé
à rien.** Aucun agent ne peut invoquer d'outil ; les listes `tools: [...]`
des 19 manifestes sont décoratives.

La garantie de sécurité est vraie *sur le papier* et non testée *dans les
faits*. Ce n'est pas une faille — rien ne s'exécute — mais c'est une
affirmation d'architecture non tenue, et le premier connecteur réel
devra la rendre vraie avant de faire le moindre appel.

### 2. Le moteur d'objectifs court-circuite l'Orchestrateur — GRAVE

`GoalEngine.execute()` appelle `agents.get(agentId).converse()` en
direct. Il vérifie bien le RBAC, mais **il ne passe pas par
l'Orchestrateur**, alors que le doc 02 pose celui-ci comme point de
routage unique.

Conséquence mesurée : `Orchestrator.plan()`, `.dispatch()` et `.route()`
ne sont appelés par personne à l'extérieur du package. Trois méthodes
publiques mortes, et deux chemins d'exécution parallèles qui vont
diverger.

**À trancher** : soit le GoalEngine passe par l'Orchestrateur, soit
l'Orchestrateur perd ces méthodes et le doc 02 est corrigé. Laisser les
deux est le pire choix.

### 3. La migration Supabase a 9 tables de retard — GRAVE

| | Tables |
|---|---|
| SQLite (réel) | 15 |
| Supabase (migration) | 6 |

Absentes : `objectives`, `key_results`, `missions`, `deliverables`,
`agent_skills`, `executive_decisions`, `published_agents`,
`metric_readings`, `people`.

Le README affirme « même structure » — **c'est faux aujourd'hui**.
Migrer vers Supabase en l'état perdrait tout l'étage objectifs et
exécutif.

### 4. Le RLS Supabase bloque tout

RLS activée sans aucune politique permissive. Cohérent avec le
deny-by-default, mais la base est inutilisable telle quelle. À traiter en
même temps que le point 3.

### 5. Le scoring ignore le risque de l'inaction

Observé en test : trésorerie à 4 mois (risque `high`, alignement 1,0) est
passée **derrière** la résiliation, parce que la formule pénalise le
risque de *l'action* sans jamais évaluer le risque de *ne rien faire*.

Sur une trésorerie critique, c'est le mauvais arbitrage. À corriger dans
le Decision Engine.

---

## Ce que je recommande, dans cet ordre

L'ordre suit la règle de priorité posée par le fondateur : **protéger
l'entreprise avant tout le reste.**

**1. Tests + CI (protection).** Aujourd'hui, rien n'empêche une
régression silencieuse sur le RBAC, le scoring ou l'ordonnanceur. Une
suite Vitest sur les 6 modules critiques et un workflow GitHub Actions.
C'est ce qui rend toutes les évolutions suivantes sûres.

**2. Réconcilier les trois dérives** (connectors, Orchestrateur,
Supabase). Peu de code, dette évitée immédiatement. Chaque semaine
d'attente rend la réconciliation plus chère.

**3. Founder Operating Manual.** Ce que tu viens d'écrire — style, ton,
valeurs, méthode de décision, ordre de priorité — est déjà la matière
première. Le transformer en couche que **tous** les agents et Brains
consomment, c'est ce qui garantit la cohérence quand le système
grossira. Peu coûteux, effet durable.

**4. Connecteur Stripe.** Le CFO Brain est aveugle. C'est le premier
connecteur qui transforme l'étage exécutif en outil de pilotage réel.

**5. Le reste** : vues manquantes, embeddings réels, ordonnanceur
persistant.

---

## Ce que cet audit ne dit pas

- **Aucune performance mesurée sous charge.** Un seul utilisateur, une
  base locale. Rien ne permet d'affirmer que ça tient à l'échelle.
- **Aucun test de sécurité offensif.** Le RBAC est correct par
  construction et vérifié sur quelques cas, pas attaqué.
- **Le mode modèle n'a jamais tourné.** Tout ce qui est vérifié l'a été
  en mode hors-ligne. Le comportement avec une vraie clé Anthropic est
  une hypothèse, pas un fait.

# 13 — Directeur Général IA

## Position dans l'architecture

```
Directeur Général   → arbitre : qui travaille, à quel coût, jusqu'où insister, quand s'arrêter
       ↓
Orchestrateur       → exécute : route un tour de travail vers un agent
       ↓
Agents              → produisent
```

L'Orchestrateur traite **un tour**. Le Directeur Général pilote **la
durée** : il regarde les performances, les coûts, les erreurs et les
délais, puis décide.

## La décision d'architecture qui compte

**Le Directeur Général n'est pas un agent conversationnel de plus. C'est
un moteur de politique déterministe.**

C'est un désaccord assumé avec l'intuition courante (« mettons un LLM
manager au-dessus »).

| Approche | Avantages | Inconvénients | Retenu ? |
|---|---|---|---|
| **LLM manager** | Jugement nuancé, s'adapte à l'imprévu | Latence et coût sur le chemin critique de *chaque* mission ; non-déterministe (deux exécutions identiques peuvent diverger) ; inauditable — « pourquoi cet agent ? » n'a pas de meilleure réponse que « le modèle a estimé » | Non |
| **Moteur de politique déterministe** (retenu) | Reproductible, gratuit, instantané, explicable par une formule chiffrée, testable unitairement | Ne gère que ce que la politique modélise | **Oui** |

Le LLM garde ce qu'il fait mieux que toute règle — rédiger un plan,
critiquer un livrable. Il est retiré de là où sa variabilité coûte plus
qu'elle ne rapporte.

**Règle générale du projet : un LLM pour le jugement, du code
déterministe pour l'arbitrage.**

## La fonction d'affectation

```
score = 0,40 × adéquation domaine
      + 0,25 × fiabilité mesurée
      + 0,15 × niveau de compétence
      + 0,10 × vitesse
      + 0,10 × efficience coût
```

Les pondérations sont des **décisions d'entreprise**, exposées comme
constantes nommées (`WEIGHTS`) pour être discutées sans relire
l'algorithme.

Le domaine domine volontairement : un agent hors domaine ne doit pas
l'emporter sur sa seule rapidité. Vitesse et coût ne servent qu'à
départager à compétence égale.

Le tri est déterministe jusqu'au bout : à score égal, l'identifiant
tranche, pour que deux exécutions identiques produisent la même
affectation.

## Les quatre décisions

| Type | Déclencheur | Effet |
|---|---|---|
| `agent_selection` | Chaque mission | Choisit l'agent, journalise le score et les alternatives écartées |
| `budget_halt` | Budget épuisé | **Interrompt** l'objectif et remonte à l'humain |
| `retry` / `abandon` | Livrable rejeté | Réessaie avec la critique, ou abandonne au plafond |
| `escalation` | Action critique ou RBAC | Remonte sans exécuter |

## Traçabilité

Chaque arbitrage est persisté avec : l'agent retenu, son score, le détail
de la formule, les trois meilleures alternatives écartées, et la raison
en clair.

C'est la condition pour qu'une entreprise délègue des décisions à ce
système sans perdre la capacité de les expliquer — à un dirigeant, à un
client, ou à un auditeur.

## Ce qui n'est pas encore fait

- Le coût est forfaitaire par tentative, pas mesuré en tokens réels.
- Pas encore de réaffectation dynamique : un agent qui échoue deux fois
  est abandonné, il n'est pas remplacé par le second du classement. C'est
  l'évolution la plus évidente une fois la télémétrie suffisamment
  fournie pour que le second choix soit fiable.

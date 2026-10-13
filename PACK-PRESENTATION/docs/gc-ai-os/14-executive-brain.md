# 14 — GC Executive Brain

## Position

```
Toi
 ↓
GC Executive Brain      ← 8 Brains spécialisés + Decision Engine
 ↓
Directeur Général        ← arbitrage d'exécution (voir 13)
 ↓
Orchestrateur            ← routage d'un tour de travail (voir 02)
 ↓
Agents                   ← production
```

Le Directeur Général décide **qui exécute une mission**. L'Executive
Brain décide **ce que l'entreprise doit faire aujourd'hui**.

## Le désaccord central : pas de débat entre huit modèles

L'intuition naturelle est de faire débattre huit personas — CEO, COO,
CTO, CFO, CMO, CRO, CHRO, Strategy — jusqu'à une décision argumentée.
C'est écarté, pour une raison technique et non idéologique :

**Huit instances du même modèle qui débattent ne produisent pas huit avis
indépendants.** Elles échantillonnent huit fois la même distribution avec
des amorces différentes, au prix de huit appels et de huit fois la
latence. On obtient le *théâtre* de la délibération sans l'information
supplémentaire qui la justifierait.

Ce qui distingue réellement un CFO d'un CMO dans une vraie entreprise,
ce n'est pas son tempérament : **c'est la donnée qu'il regarde.** Le CFO
voit Stripe, le CMO voit les statistiques d'audience. C'est cette
asymétrie d'information qui crée la valeur d'un comité de direction.

Les Brains sont donc définis par leur **périmètre de données**, pas par
une personnalité :

| Approche | Avantages | Inconvénients | Retenu ? |
|---|---|---|---|
| **Débat de personas** | Argumentaires riches, impression de délibération | Coût et latence ×8 ; non reproductible ; les « avis » sont corrélés ; inauditable | Non |
| **Analystes instrumentés + arbitrage calculé** (retenu) | Chaque Brain voit des données distinctes ; décisions reproductibles et explicables ; coût nul en arbitrage | Ne détecte que ce que les seuils modélisent | **Oui** |

La délibération n'est pas supprimée — elle est **réservée aux vrais ex
æquo**. Quand deux propositions sont à moins de 0,05 d'écart, les
chiffres ne tranchent pas, et c'est exactement là qu'un arbitrage humain
apporte quelque chose. Le briefing le signale explicitement.

## Le substrat de métriques

Rien de tout cela ne vaut sans données. La fondation est
`@gc-ai-os/metrics`, avec une règle unique :

> `value: number | null` — `null` signifie **non mesuré**, et c'est un
> état de premier ordre, jamais remplacé par 0 ni par une estimation.

Un tableau de bord affichant « Marketing : 95 » sans source fabrique une
confiance injustifiée et oriente des décisions réelles sur du vide. Un
dirigeant qui décide sur un chiffre inventé décide plus mal que s'il
n'avait rien eu.

Conséquence directe : **le catalogue de 28 métriques est presque
entièrement vide aujourd'hui, et c'est sa valeur.** Il dit exactement ce
qu'il faut brancher — Stripe pour le MRR, Supabase pour l'activité
ambassadeurs, GitHub pour les bugs — et dans quel ordre.

Seule exception : les métriques `derived` que le système mesure sur
lui-même (missions terminées, bloquées, validations en attente, taux de
succès des agents). Elles ne dépendent d'aucun connecteur externe.

## Le Decision Engine

Les questions posées avant chaque décision — alignement, rentabilité,
risque, urgence, horizons — deviennent des critères pondérés :

```
score = 0,25 × alignement vision
      + 0,25 × ROI (impact / effort)
      + 0,20 × confiance
      + 0,15 × urgence (horizon)
      + 0,15 × sûreté (1 − risque)
```

### La confiance, mécanisme anti-hallucination

`confiance` est dérivée de la **matière mesurée** qui fonde la
proposition : 0,25 sans aucune preuve chiffrée, jusqu'à 1,0 avec
plusieurs métriques réelles.

Une proposition sans données n'est pas interdite — elle démarre
simplement bas et ne peut pas battre un constat étayé. Effet recherché,
et observé en fonctionnement : **quand le système ne voit rien, sa
proposition prioritaire devient « branche cette source de données »**
plutôt qu'un diagnostic stratégique inventé qui aurait l'air sérieux.

## GC Enterprise Score

Note par département, calculée depuis les métriques ayant une cible
objectivement défendable. Un département sans données affiche **« non
mesuré »**, jamais 0 ni une estimation — et la note globale reste
`null` tant qu'aucun département n'est notable.

Les cibles ne sont posées que lorsqu'elles ont un sens métier réel
(résiliation à 5 %, coût d'acquisition sous le prix de l'abonnement à
67 €, conversion ambassadeurs à 3,4 %, incidents en production à 0). Une
métrique sans cible défendable est comptée comme mesurée mais n'entre
pas dans la note : inventer un seuil produirait une évaluation
arbitraire présentée comme un jugement.

## Le briefing du matin

`GET /api/executive` et `/api/executive/briefing` (Markdown
téléchargeable) produisent le rituel :

1. Note d'entreprise par département, avec les non-mesurés visibles.
2. Priorité du jour, argumentée, avec le détail chiffré de l'arbitrage.
3. Constat de chacun des 8 Brains — y compris « je ne vois rien ».
4. Ce qui empêche d'y voir clair : les métriques à instrumenter.

## Limites assumées

- Les seuils des Brains sont des règles explicites, pas un apprentissage.
  C'est volontaire en phase 1 : une règle se discute et se corrige, un
  seuil appris sur trois semaines de données ne vaut rien.
- Aucun Brain ne déclenche encore d'objectif automatiquement ; la
  priorité est proposée, un humain la lance.
- L'`executionDomain` de chaque proposition pointe vers un domaine
  d'agent réel, mais le pont automatique vers le moteur d'objectifs
  (voir 10) reste à câbler.

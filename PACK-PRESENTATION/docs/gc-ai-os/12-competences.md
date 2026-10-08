# 12 — Système de compétences mesurées

## Le principe non négociable

**Un niveau de compétence n'est jamais saisi à la main. Il est toujours
dérivé d'exécutions réelles.**

C'est ce qui distingue une télémétrie d'un simple champ déclaratif. Un
agent ne « sait pas faire » quelque chose parce qu'on l'a écrit dans son
manifeste ; il sait le faire parce qu'il l'a fait, et on a mesuré.

## Ce qui est suivi

Pour chaque couple (agent, compétence) :

| Donnée | Origine |
|---|---|
| `runs` / `successes` | Incrémentés à chaque mission exécutée |
| `level` (0–100) | **Dérivé** du taux de succès lissé — jamais écrit directement |
| `reliability` | Taux de succès avec lissage de Laplace |
| `avgDurationMs` | Moyenne glissante des durées réelles |
| `avgCostMicros` | Moyenne glissante des coûts imputés |
| `lastUsedAt` | Dernière exécution |

## Le lissage de Laplace, et pourquoi

Un agent sans historique pose un problème classique : s'il démarre à 0,
il ne sera jamais choisi et ne fera donc jamais ses preuves ; s'il démarre
à 1, il gagne à tort contre des agents éprouvés.

```
fiabilité = (succès + 1) / (essais + 2)
```

Un agent neuf démarre donc à 0,5 — ni favorisé ni exclu — et converge
vers son taux réel avec l'usage. Un agent avec 1 succès sur 1 essai
affiche 0,67, pas 1,0 : la confiance se gagne progressivement.

Même logique pour la vitesse et le coût : un agent sans mesure obtient un
neutre 0,5 plutôt qu'un score parfait, sinon « jamais mesuré » vaudrait
« instantané et gratuit ».

## À quoi ça sert

Ces données alimentent les décisions du Directeur Général (voir 13). Sans
elles, l'affectation d'agents ne peut être qu'arbitraire ou portée par un
LLM — deux options inauditables.

Avec elles, la question « pourquoi cet agent ? » a une réponse chiffrée,
reproductible, et discutable.

## Effet de composition

C'est le mécanisme qui rend la plateforme meilleure avec le temps sans
intervention humaine : chaque mission exécutée affine la connaissance que
le système a de ses propres agents, donc la qualité de ses affectations
futures. Un concurrent qui démarre n'a pas cet historique — c'est un
actif qui s'accumule.

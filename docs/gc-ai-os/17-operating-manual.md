# 17 — Founder Operating Manual

## Pourquoi un manuel et pas seulement un profil de communication

Un profil de communication décrit **comment parler**. Il suffit tant qu'il
y a trois agents écrits par la même personne.

Un manuel de direction décrit **comment décider** : critères, ordre de
priorité, distinction fait/hypothèse/estimation, comportements attendus,
erreurs à ne pas répéter.

La différence devient structurelle dès que le système grossit. Sans
manuel, chaque nouvel agent hérite du style de celui qui l'a écrit, et
un agent fabriqué par la Factory dans six mois n'a aucune raison de se
comporter comme ceux d'aujourd'hui. Avec le manuel, la cohérence est une
propriété du système, pas une discipline à maintenir à la main.

## Deux consommateurs, un seul texte

```
FOUNDER_OPERATING_MANUAL  (packages/agents-core/src/operating-manual.ts)
        ├── ConversationalAgent  → injecté dans le prompt système de TOUS les agents
        │                          (les 19 du catalogue + tout agent fabriqué)
        └── Decision Engine       → PRIORITY_ORDER pondère l'arbitrage
```

Le point important est le second. L'ordre de priorité n'est pas une
consigne écrite dans un prompt en espérant qu'un modèle la respecte :
c'est un **poids calculé** dans la formule d'arbitrage.

```
score = 0,20 × alignement
      + 0,20 × ROI
      + 0,20 × confiance
      + 0,15 × urgence
      + 0,15 × priorité d'entreprise   ← le manuel, en dur dans le calcul
      + 0,10 × sûreté
```

Effet vérifié par test : à valeur égale, une proposition du domaine
`securite` (priorité « protéger ») bat une proposition du domaine
`recherche` (priorité « optimiser »).

## L'ordre de priorité

| Rang | Priorité | Domaines rattachés |
|---|---|---|
| 1 | Protéger l'entreprise | securite, conformite, qualite |
| 2 | Satisfaire les clients | support-client, succes-client |
| 3 | Développer les revenus | commercial, marketing, finance |
| 4 | Améliorer les équipes | recrutement, contenu |
| 5 | Automatiser | automatisation, infrastructure |
| 6 | Optimiser | tout le reste |

En cas de conflit, la priorité la plus haute tranche. C'est ce qui fait
qu'un audit de sécurité passe devant une optimisation de conversion,
même si la seconde a un meilleur retour sur investissement apparent.

## Fait, hypothèse, estimation

Le manuel impose aux agents de distinguer explicitement les trois. Ce
n'est pas une exigence de style : c'est la même règle que celle du
substrat de métriques, où `null` signifie « non mesuré » et n'est jamais
remplacé par 0.

Un dirigeant qui ne sait pas si un chiffre est mesuré ou estimé ne peut
pas calibrer sa confiance — et prend une moins bonne décision qu'avec
moins d'information mais mieux qualifiée.

## Identité

Le système parle **au nom de l'équipe Génération Capable**. Le style est
inspiré de la manière de diriger du fondateur ; l'origine du message
reste transparente.

Reproduire un style est légitime. Emprunter une identité ne l'est pas —
y compris avec de bonnes intentions, parce qu'un ambassadeur qui
découvre qu'un message « personnel » était automatique perd confiance
dans tout le reste. Voir 15-human-brain.md.

## Ce qui reste à faire

- Le manuel est un texte constant. La prochaine étape naturelle est de
  le rendre **éditable depuis l'interface** et versionné en base, pour
  qu'il évolue sans redéploiement.
- La section « erreurs que je refuse de répéter » n'est pas encore
  alimentée. Elle devrait dériver automatiquement des entrées de mémoire
  de type `error` (voir 04-memoire.md) plutôt que d'être rédigée à la
  main — le système sait déjà ce qui a échoué.

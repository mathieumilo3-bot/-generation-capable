# 21 — Audit et autocritique de GC Brain (05/08/2026)

Même exigence qu'en 16 : ce document doit dire ce qui est faible dans
17-20, pas seulement ce qui est ambitieux. Écrit le jour même de la
conception, avant que qui que ce soit ait eu le temps de découvrir les
problèmes en production — c'est volontaire, pour que l'audit précède
l'implémentation plutôt que de la suivre, comme le veut le principe 5 de
01 (« jamais coder sans plan »).

## Ce qui existe réellement aujourd'hui, sur les 13 agents de 18

**Un seul.** GC Coach, en production, dans `ambassadors.html`. Tout le
reste — GC Pilot, GC Command Center, GC Content, GC Video Review, GC
Recruiter, GC Closing, GC Call Review, GC Performance, GC Community, GC
Support (couche IA), GC Momentum — est un plan, pas du code. La mission du
jour actuellement affichée dans `ambassadors.html` (`mission-title`) est
un texte statique, pas une sortie de GC Pilot. Les 7 scores de 19
n'existent dans aucune table Supabase de ce repository à ce jour.

Il faut le dire aussi clairement que 16 l'a fait pour l'OS interne :
**écrire ces 5 documents ne fait avancer aucune ligne de code.** Ce qui
transforme ce plan en réalité, c'est la Phase 1 de 20 — et rien d'autre.
Si dans un mois GC Pilot n'existe toujours pas, ces documents rejoignent
la colonne « promis et absent » de 16, avec la même conséquence : une
perte de confiance dans la documentation elle-même.

## Faiblesses identifiées dans l'architecture proposée

### 1. Le risque de sur-notification n'est pas suffisamment garde-fouté

19 pose des règles de priorité, mais aucune limite dure (« jamais plus de
N notifications Haute par jour et par membre », toutes sources
confondues). Sans ce plafond global, chaque agent peut individuellement
respecter ses propres règles et pourtant, cumulés, submerger un membre.
**Correction à apporter avant Phase 1** : GC Command Center doit imposer
un budget quotidien de notifications par membre, arbitrer entre agents
concurrents pour ce budget, pas seulement prioriser à l'intérieur de
chaque agent.

### 2. Le score de motivation est le plus dangereux des 7

19 précise qu'il ne doit jamais être affiché en chiffre brut au membre —
c'est nécessaire mais insuffisant. Un score de motivation mal calibré
peut déclencher des relances qui *aggravent* le décrochage (une personne
en difficulté qui reçoit une notification de plus le vit comme une
pression, pas comme un soutien). **Correction** : toute action déclenchée
par une baisse de motivation doit être testée par petits lots (A/B, sur
un sous-groupe) avant généralisation, jamais déployée directement à toute
la base — ce document ne le disait pas, c'est une lacune.

### 3. Consentement et contrôle du membre absents de 17-20

15 (Human Brain, côté fondateur) pose déjà le principe de consentement
avant personnalisation. Ce même principe **manque entièrement côté
membre** dans ce volet : aucun endroit dans 17-20 ne donne au membre le
contrôle sur l'intensité du pilotage (« pilote-moi fort » vs « laisse-moi
tranquille, préviens-moi seulement si c'est important »). C'est une
incohérence avec les propres principes déjà posés par ce projet, pas
seulement un oubli mineur. **À ajouter avant Phase 1** : un réglage
explicite, visible, dans l'écran Profil de `ambassadors.html`.

### 4. Le coût par membre n'est jamais chiffré dans 17-20

L'économie de l'abonnement (67€/mois, déjà documentée dans
`AMBASSADOR_SYSTEM_PROMPT` et `bibliotheque.html`) impose une limite
stricte : le coût d'IA par membre doit rester une fraction raisonnable de
cette marge. GC Video Review et GC Call Review (Phase 3) sont
explicitement coûteux (18) mais aucun chiffre, même approximatif, n'est
posé nulle part. **Manque** : un budget de coût IA par membre et par mois,
suivi par le Finance Agent existant (03), avant que Phase 3 ne démarre —
sinon la croissance décrite en Phase 4-5 (20) dégrade silencieusement la
marge.

### 5. Le risque de triche sur les scores n'est pas traité

Dès que des scores pilotent des notifications valorisantes et des
classements (GC Community, 18), quelqu'un cherchera à les manipuler
(publications creuses juste pour le score d'activité, recrutements
artificiels pour GC Momentum). 19 mentionne un garde-fou anti-abus
seulement pour le scénario « 5 recrutements » — **ce n'est pas
généralisé**. Correction : chaque score doit avoir une vérification de
plausibilité (comme celle déjà écrite pour les recrutements), pas
seulement celui-là.

### 6. GC Recruiter parle à des prospects sans compte — surface RGPD non couverte

17 pose le RLS Supabase comme protection de données, mais un prospect
qualifié par GC Recruiter (18) n'a pas encore de compte, donc pas encore
de ligne protégée par RLS classique. **Manque** : préciser où vit
techniquement une conversation de prospect avant conversion, sa durée de
rétention si le prospect ne rejoint jamais, sa suppression si demandée —
sujet pour Legal & Compliance Agent (03), pas traité ici.

### 7. Dépendance à un seul fournisseur de modèle non discutée

Tous les agents (18) s'appuient sur un LLM, aujourd'hui un seul fournisseur
(`ai-proxy.js`). Aucune des 21 sections ne discute d'un plan de repli si ce
fournisseur a une panne ou change ses conditions. À l'échelle de la Phase
1 (15 personnes), le risque est mineur ; à la Phase 4-5 (20), un système
qui pilote 5 000 à 50 000 personnes sans plan de repli est une
dépendance stratégique qui mérite d'être écrite explicitement, pas
découverte pendant un incident.

## Fonctionnalités à couper ou fusionner

Ce catalogue (18) en propose déjà 4 comme des « vues » plutôt que des
systèmes séparés (GC Assistant, GC Momentum en partie, GC Command Center
comme fonction de GC Brain, GC Recruiter/GC Closing comme spécialisations
de GC Coach). En plus de ces fusions déjà actées :

- **GC Community et GC Momentum se recouvrent trop** pour rester deux
  entrées séparées au-delà de la Phase 1 : les deux gèrent des
  récompenses et de la reconnaissance. Proposition : GC Momentum reste le
  moteur de règles (18) ; GC Community en devient un canal de diffusion
  (l'annonce publique), pas un agent avec sa propre logique de décision.
- **Retirer du périmètre initial** : la préparation de directeur avant
  appel par GC Coach (mentionnée comme « extension prévue » en 18) est une
  bonne idée mais n'a aucune urgence avant la Phase 2 — elle ne doit pas
  être confondue avec le socle de Phase 1.

## Innovations non présentes dans la demande initiale

- **Budget quotidien de notifications par membre**, arbitré par GC Command
  Center entre tous les agents (faiblesse 1 ci-dessus, transformée en
  fonctionnalité concrète à construire).
- **Réglage d'intensité de pilotage contrôlé par le membre** (faiblesse 3
  ci-dessus) — au-delà de la conformité, c'est un argument produit :
  « le seul système qui te pousse exactement à la dose que tu choisis ».
- **Explicabilité minimale obligatoire** : toute recommandation de GC
  Pilot ou GC Content doit pouvoir afficher, en une phrase, le fait ou le
  score qui l'a déclenchée (« parce que ton score de régularité a baissé »
  plutôt qu'une suggestion qui semble sortie de nulle part). Renforce la
  confiance et facilite le débogage — absent de la demande initiale, mais
  cohérent avec l'exigence d'honnêteté déjà répétée dans tout le projet.
- **Circuit breaker sur la corrélation notification → churn** : si GC
  Performance détecte qu'un type de notification est statistiquement
  associé à plus de désabonnements plutôt que moins, ce type de
  notification doit être suspendu automatiquement en attendant une revue
  humaine, pas continuer parce que la règle métier initiale semblait
  bonne sur le papier.
- **Le principe de souveraineté humaine, déjà écrit pour GC Coach, doit
  être une règle transversale à tout GC Brain**, pas seulement à un
  agent : aucune action irréversible ou visible publiquement (publication,
  mise en avant communautaire, changement de rôle) ne part jamais sans
  confirmation explicite du membre concerné.

## Ce que cet audit ne dit pas

- Aucun de ces 5 documents n'a été confronté à un vrai membre. Tout ce qui
  est écrit ici est une hypothèse de conception, pas un résultat observé.
- Le chiffrage de coût (faiblesse 4) reste qualitatif — aucun chiffre réel
  n'a été calculé, faute de volume d'usage à mesurer aujourd'hui.
- Rien ici ne remplace un vrai test utilisateur sur les 15 premiers
  ambassadeurs une fois GC Pilot construit (Phase 1, 20) — c'est ce test,
  pas ce document, qui validera ou invalidera l'architecture.

## Prochaine action concrète, pas une nouvelle section de plan

Construire GC Pilot en version la plus simple possible (règles
déterministes, pas de LLM pour la priorité) pour les 15 ambassadeurs
actuels, comme fonction serverless dans ce repository, à côté de
`ai-proxy.js`. C'est la seule ligne de cet audit qui compte vraiment tant
qu'elle n'est pas faite.

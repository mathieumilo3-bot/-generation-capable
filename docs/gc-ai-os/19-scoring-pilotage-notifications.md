# 19 — Scoring, pilotage, notifications, automatisations

## Les 7 scores

Chaque membre a 7 scores, recalculés en continu par GC Performance (18) et
consommés par tous les autres agents pour adapter leur comportement.
Aucun score n'est une note morale — chacun sert une décision précise.

| Score | Mesure | Alimenté par | Décision qu'il pilote |
|---|---|---|---|
| **Activité** | Fréquence des actions (publication, message, appel) sur les 7 derniers jours | Événements produit | Déclenche GC Command Center si chute brutale |
| **Progression** | Avancement dans la formation + les objectifs personnels | GC Pilot, modules terminés | Ajuste le niveau de mission proposée par GC Pilot |
| **Discipline** | Régularité d'exécution des missions proposées (complétées vs proposées) | GC Pilot | Calibre le volume de missions du lendemain |
| **Régularité** | Écart-type des jours d'activité (actif tous les jours vs par à-coups) | Événements produit | Détermine le rythme de notification (19.3) |
| **Motivation** | Signal composite : régularité récente + sentiment détecté en conversation (GC Coach) + réponse aux relances | GC Coach, GC Community | Déclenche GC Momentum en priorité haute |
| **Compétence** | Qualité réelle du travail produit (vidéos, appels) — jamais le volume seul | GC Video Review, GC Call Review | Alimente les recommandations de contenu de GC Content |
| **Leadership** | Pour les directeurs/têtes d'équipe : qualité d'accompagnement de leur équipe, pas leurs propres résultats individuels | GC Performance (agrégat d'équipe) | Alimente le dashboard directeur/CEO |

**Règle commune aux 7 scores** : un score non mesurable (pas assez de
données, ex. un membre du jour 1) s'affiche « en cours de calibrage »,
jamais une valeur par défaut arbitraire qui donnerait une fausse
impression de précision — même principe que l'Enterprise Score honnête de
14.

## Système de pilotage — qui reçoit quoi

```
   Membre  ──scores + missions──▶  GC Pilot
      │
      ▼ (agrégat d'équipe, jamais les conversations privées)
   Directeur des Ambassadeurs / Directeur Commercial
      │
      ▼ (agrégat global, escalade sur exception uniquement)
   CEO
```

Règle stricte : **chaque niveau ne reçoit que ce qu'il peut agir dessus.**
Un directeur ne reçoit pas le contenu d'une conversation GC Coach — il
reçoit « ce membre a un score de motivation en baisse, voici le contexte
utile pour ton prochain appel avec lui ». Le CEO ne reçoit pas la liste
des 500 membres — il reçoit les exceptions (une équipe qui décroche, une
tendance de fond) et un résumé quotidien (briefing du matin, même logique
que 14).

## Notifications

### Principe

Une notification qui n'aide pas à agir ne doit jamais être envoyée. Chaque
notification a : un déclencheur, un destinataire, une priorité, une
action proposée en un tap, une règle d'expiration (si l'action n'est plus
pertinente après N heures, la notification disparaît plutôt que de rester
comme bruit).

### Niveaux de priorité

| Niveau | Fenêtre d'envoi | Exemple de canal |
|---|---|---|
| **Critique** | Immédiat, à toute heure | Push |
| **Haute** | Dans l'heure, fenêtre d'éveil du destinataire uniquement | Push |
| **Normale** | Regroupée au prochain moment naturel (ouverture d'app, débrief du soir) | In-app |
| **Info** | Jamais poussée seule — visible seulement si le membre consulte l'écran concerné | In-app, passif |

### Règles d'escalade

Une alerte « Haute » sans action du destinataire après le délai prévu
remonte automatiquement d'un niveau (membre → directeur → CEO), avec le
contexte déjà rassemblé — jamais en repartant de zéro. Une alerte traitée
par un niveau supérieur avant que le niveau inférieur ait eu le temps
d'agir se retire silencieusement des deux côtés (pas de double
traitement).

### Exemples par destinataire

**Membre (ambassadeur/vendeur)**

| Déclencheur | Priorité | Message type |
|---|---|---|
| Mission du jour prête | Normale | « Ta mission du jour : [action]. Pourquoi : [raison courte]. » |
| Aucune activité depuis 48h | Haute | « Tout va bien ? Reprends avec une action de 5 minutes : [suggestion]. » |
| Objectif personnel atteint | Haute | « Objectif atteint : [nom]. Prochaine étape : [suggestion]. » |
| Vidéo analysée disponible | Normale | « Ton analyse est prête — un point fort et une amélioration t'attendent. » |
| Palier de score franchi | Normale | « Tu passes au niveau [X] en [score]. » |
| Commission créditée | Haute | « +[montant] crédités — [nom du filleul] vient de rejoindre. » |
| 3 jours sans publication après une série active | Haute | « Tu avais une belle régularité — un petit pas aujourd'hui la relance. » |
| Réponse à une question FAQ jamais couverte | Info | Visible uniquement dans l'historique de conversation. |

**Directeur des Ambassadeurs / Directeur Commercial**

| Déclencheur | Priorité | Message type |
|---|---|---|
| Un membre de l'équipe a un score de motivation en chute sur 5 jours | Haute | « [Prénom] montre des signes de décrochage — contexte : [résumé]. Un appel cette semaine ? » |
| Un membre recrute pour la première fois | Normale | « [Prénom] a fait sa première recrue — un mot de félicitation aide à ancrer l'habitude. » |
| L'équipe entière ralentit (score d'activité moyen en baisse) | Haute | « L'équipe ralentit depuis [période] — cause probable : [analyse GC Performance]. » |
| Un membre est prêt pour plus de responsabilité (scores élevés et stables) | Normale | « [Prénom] est constant depuis [durée] — un bon moment pour lui proposer plus. » |
| Escalade depuis GC Support (blocage non résolu) | Critique | « [Prénom] a un blocage non résolu par le support automatique — action requise. » |

**CEO**

| Déclencheur | Priorité | Message type |
|---|---|---|
| Briefing quotidien | Normale (heure fixe) | Résumé : croissance, décrochages, tendances, une décision proposée si nécessaire. |
| Une équipe entière décroche | Critique | « L'équipe de [Directeur] a un score d'activité en baisse de [X]% — voir détail. » |
| Croissance qui dépasse la capacité d'accompagnement actuelle | Haute | « Le rythme de recrutement dépasse la capacité de suivi actuelle — voir 20-roadmap. » |
| Une tendance de fond (positive ou négative) confirmée sur plusieurs semaines | Normale | Résumé avec cause identifiée par GC Performance, jamais une corrélation brute non expliquée. |

Ces tableaux ne sont pas exhaustifs — ils posent la taxonomie
(déclencheur → priorité → destinataire → action). Ajouter une nouvelle
notification, c'est remplir une ligne dans cette taxonomie, jamais
inventer une nouvelle mécanique.

## Automatisations

Chaque scénario suit le même schéma : **Déclencheur → Analyse GC Brain →
Agents mobilisés → Résultat visible.** Aucune automatisation n'agit
silencieusement sur les données financières ou le statut d'un membre sans
notification correspondante.

### Pas de vidéo depuis 48h

Déclencheur : événement d'inactivité de publication.
Analyse : GC Command Center vérifie le score de régularité — première
fois (pas d'alerte, c'est normal) ou rupture d'un rythme établi (alerte).
Agents mobilisés : GC Pilot propose une mission courte et facile (baisser
la barre plutôt que relancer fort) ; GC Content prépare une idée prête à
tourner ; si la rupture persiste à 96h, GC Command Center alerte le
directeur avec contexte.
Résultat visible : notification membre (Haute), puis notification
directeur seulement si la première n'a pas d'effet.

### Quelqu'un recrute 5 personnes

Déclencheur : 5 recrues créditées sur une fenêtre courte.
Analyse : GC Performance vérifie que ce n'est pas un artefact (5 recrues
le même jour depuis la même source suspecte déclenche une vérification
anti-abus plutôt qu'une célébration automatique).
Agents mobilisés : GC Momentum déclenche une reconnaissance immédiate ;
GC Community propose une mise en avant (avec accord du membre, jamais
imposée) ; GC Command Center informe le directeur, qui décide s'il propose
une évolution de rôle.
Résultat visible : notification membre (Haute, immédiate), proposition au
directeur (Normale).

### Quelqu'un perd sa motivation

Déclencheur : score de motivation sous un seuil, confirmé sur plusieurs
jours (jamais sur un seul mauvais jour).
Analyse : GC Coach cherche la cause dans les conversations récentes
(bloqué techniquement ? découragé par un résultat ? événement personnel
évoqué ?) avant de proposer une action — jamais une relance générique.
Agents mobilisés : GC Momentum réduit le volume de missions proposées
(pas l'exigence) ; GC Coach propose une conversation ; si aucune réponse
sous 5 jours, GC Command Center alerte le directeur avec le contexte déjà
rassemblé.
Résultat visible : ton adapté dans l'app (moins de pression visuelle,
plus d'encouragement), notification directeur seulement en dernier
recours.

### Quelqu'un explose les statistiques

Déclencheur : scores de compétence et de progression en forte hausse
simultanée, sur une durée suffisante pour exclure un pic ponctuel.
Analyse : GC Performance distingue une vraie montée en compétence d'un
concours de circonstances (une seule vidéo virale ne fait pas une
tendance).
Agents mobilisés : GC Content analyse ce qui a fonctionné pour le
reformuler en système réutilisable (voir `bibliotheque.html`, section
Systèmes) ; GC Community propose une étude de cas (section 19 de la
bibliothèque) avec l'accord du membre ; le directeur reçoit une
proposition d'évolution de rôle.
Résultat visible : le succès individuel devient un contenu pédagogique
pour toute la communauté, pas seulement une célébration isolée.

### Une équipe ralentit

Déclencheur : score d'activité moyen d'une équipe en baisse sur plusieurs
semaines.
Analyse : GC Performance cherche la cause commune avant d'alerter — un
changement de saison, un événement externe, ou un problème propre à
l'équipe (leadership, moral) donnent des réponses différentes.
Agents mobilisés : GC Command Center alerte le directeur avec la cause
proposée et deux options d'action, jamais dix ; le CEO est informé
seulement si le ralentissement touche plusieurs équipes en même temps
(signal de tendance de fond, pas un problème local).
Résultat visible : notification directeur (Haute), notification CEO
seulement si le pattern se répète sur plusieurs équipes.

### Autres scénarios couverts par la même taxonomie (non détaillés)

Premier appel raté, premier appel réussi, retour d'un membre après une
pause longue, désabonnement en cours de traitement, objection récurrente
détectée chez plusieurs membres en même temps (remonte comme suggestion
d'enrichir la bibliothèque, jamais silencieusement ignorée), directeur
lui-même en surcharge (trop d'alertes non traitées — GC Command Center
réduit alors le volume avant d'ajouter une alerte de plus).

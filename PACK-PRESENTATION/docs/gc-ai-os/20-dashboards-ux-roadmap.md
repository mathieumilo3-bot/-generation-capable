# 20 — Dashboards, expérience utilisateur, roadmap

## Dashboards par rôle

Principe commun aux 5 : simple, actionnable, jamais surchargé. Un
dashboard qui affiche 20 chiffres sans dire quoi en faire a échoué — même
philosophie de design que `ambassadors.html` (déjà en production : cartes
courtes, une priorité mise en avant, pas de tableau dense). Aucun nouveau
langage visuel n'est nécessaire : les dashboards ci-dessous réutilisent le
système existant (cartes, badges, barre de progression, palette
or/sombre — voir `bibliotheque.html`, section Ressources, pour la charte).

### Ambassadeur / Vendeur

Déjà largement construit dans `ambassadors.html` (écrans Aujourd'hui,
Revenus, Formation). Ce que GC Brain y ajoute :
- La mission du jour (déjà présente comme carte statique) devient générée
  par GC Pilot et se met à jour si le contexte change dans la journée.
- Une carte « pourquoi » discrète sous chaque mission (une ligne, jamais
  un paragraphe) — répond directement à l'objectif « jamais avoir à
  réfléchir ».
- Le score de motivation n'est **jamais affiché comme un chiffre brut** au
  membre lui-même (afficher « ta motivation : 42/100 » démotive plus
  qu'autre chose) — il se traduit en ton et en volume de mission, jamais
  en note visible.

### Directeur des Ambassadeurs / Directeur Commercial

Écran nouveau, structure :
1. Une carte « aujourd'hui » : les 2-3 membres qui ont le plus besoin
   d'attention aujourd'hui, avec la raison et une action suggérée en un
   tap (appeler, féliciter, débloquer).
2. Une vue équipe : scores agrégés, jamais un tableau nominatif de 50
   lignes par défaut — le nominatif s'ouvre à la demande.
3. Un historique des actions du directeur lui-même (ce qu'il a traité) —
   pour que son propre score de leadership (19) reste basé sur des faits,
   pas sur une impression.

### CEO

1. Briefing du jour (même logique que le briefing du matin de 14) :
   croissance, décrochages, tendances, une décision proposée si
   nécessaire — jamais une liste brute de métriques.
2. Vue par équipe/directeur, agrégée.
3. Escalades en attente (ce qui a remonté depuis le pilotage, 19) avec le
   contexte déjà préparé — jamais à reconstituer l'historique soi-même.

## Expérience utilisateur

### Premier jour

Le membre active son compte (déjà en place : lien magique par email, voir
correctif du 05/08). Premier écran : GC Assistant (18) se présente,
construit *la première* mission — volontairement unique et facile
(« regarde le module 1 », pas cinq tâches à la fois) pour garantir une
première victoire rapide plutôt qu'une liste qui décourage. GC Coach est
visible dès le premier écran (bulle de bienvenue), mais ne pousse jamais
de message non sollicité ce jour-là — laisser le membre explorer avant de
lui parler.

### Première semaine

GC Pilot introduit une deuxième puis une troisième mission par jour,
seulement si la veille a été complétée (règle GC Momentum : monter le
volume seulement après une réussite, jamais en anticipation). GC Content
propose une première idée de publication à partir du jour 3-4, une fois
que le membre a lu le minimum de bibliothèque nécessaire (section
« Commencer ici »). Le score de régularité commence à être visible en
arrière-plan (jamais affiché en chiffre — se traduit en badge « série de
X jours »).

### Premier mois

GC Command Center commence à produire des signaux fiables (un mois de
données est le minimum pour distinguer un vrai décrochage d'un mauvais
jour). Le directeur reçoit ses premières notifications de pilotage (19).
GC Performance produit la première analyse de tendance individuelle
(« ce qui fonctionne pour toi »).

### Ce que le membre voit (IA visible) vs ne voit jamais (IA invisible)

| Visible | Invisible |
|---|---|
| GC Coach (conversation), GC Pilot (mission du jour), GC Content (propositions), GC Assistant (rituel matin/soir), GC Momentum (récompenses, badges) | GC Command Center (surveillance), GC Performance (calcul des scores), GC Brain (routage) |

Aucune IA invisible ne doit jamais être *découverte* par accident (ex. un
membre qui verrait une trace technique de scoring) — c'est un signal que
la séparation d'interface a une fuite, à corriger immédiatement.

## Roadmap — 5 phases

Même règle qu'en 09 : on ne démarre pas une phase avant que la précédente
soit validée sur des cas réels. La généralisation prématurée reste le
risque principal.

### Phase 1 — 15 ambassadeurs (aujourd'hui)

Objectif : le socle minimum qui rend GC Brain réel plutôt qu'un document.

- **Prioritaire** : GC Pilot (missions du jour, même dans sa version la
  plus simple — règles déterministes, pas encore de LLM pour la
  priorisation), GC Content (déjà quasi-couvert par la bibliothèque
  statique — première étape : rendre les propositions personnalisées),
  GC Support en couche sur le Centre de Support existant, GC Momentum
  (badges/séries — mécanique simple, fort effet sur l'engagement
  quotidien).
- **Peut attendre** : GC Video Review et GC Call Review (Phase 3 —
  coûteux, inutile avant d'avoir assez de vendeurs/appels pour justifier
  l'infra), GC Recruiter et GC Closing (Phase 2 — utile seulement une
  fois qu'il y a un flux de prospects réel à qualifier).
- **Risques** : construire trop d'agents avant d'avoir validé que GC Pilot
  change vraiment le comportement quotidien des 15 premiers ambassadeurs
  — répéter l'erreur déjà documentée dans 16-audit.md pour GC AI OS
  interne.
- **Gains attendus** : un onboarding qui ne perd personne dans les 7
  premiers jours (mesurable), une régularité de publication en hausse
  mesurable sur ces 15 personnes.
- **Critère de sortie** : GC Pilot produit une mission quotidienne
  correctement priorisée pour chacun des 15 ambassadeurs pendant 30 jours
  consécutifs, sans intervention manuelle sur la logique.

### Phase 2 — 100 membres

- **Prioritaire** : GC Command Center (le pilotage manuel ne scale plus à
  100), GC Recruiter et GC Closing (le flux de prospects devient
  suffisant), le dashboard Directeur (19-20), passage du routage de GC
  Pilot d'un système de règles pures à un système hybride
  règles + LLM là où c'est justifié.
- **Peut attendre** : GC Video Review/Call Review (encore Phase 3).
- **Risques** : le volume de notifications explose si les règles de
  priorité (19) ne sont pas assez strictes — sur-notifier détruit la
  confiance plus vite que sous-notifier.
- **Gains attendus** : un directeur peut suivre son équipe sans relire
  chaque conversation individuellement.
- **Critère de sortie** : un directeur reçoit en moyenne moins de 5
  notifications « Haute » par jour et peut agir sur chacune en moins de 2
  minutes.

### Phase 3 — 500 membres

- **Prioritaire** : GC Video Review, GC Call Review (le volume justifie
  enfin le coût d'infra), GC Community (l'animation manuelle ne scale
  plus à 500), convergence technique avec le monorepo `gc-ai-os` — c'est
  le point où les deux volets (17) commencent à partager une
  infrastructure réelle plutôt que des principes seulement.
- **Peut attendre** : personnalisation fine du ton par profil
  psychologique détaillé — utile mais pas bloquant.
- **Risques** : le coût par membre (analyse vidéo/appel) doit être suivi
  de près — un coût qui grossit plus vite que les revenus par membre est
  un signal d'alerte immédiat pour le CEO (Finance Agent de GC AI OS
  interne, 03, devient consommateur direct de cette donnée).
- **Gains attendus** : la qualité moyenne du contenu produit par les
  membres augmente mesurablement (score de compétence, 19).
- **Critère de sortie** : GC Video Review et GC Call Review tournent sur
  100 % des vidéos/appels sans backlog de traitement supérieur à 24h.

### Phase 4 — 5 000 membres

- **Prioritaire** : passage du pilotage humain (directeurs) à un modèle où
  chaque directeur encadre une équipe de taille bornée, avec GC Command
  Center qui répartit automatiquement les nouveaux membres entre
  directeurs selon leur charge actuelle. Multi-tenant technique renforcé
  (isolation par équipe, pas seulement par membre).
- **Peut attendre** : rien de nouveau dans le catalogue d'agents — à ce
  stade, la priorité est la fiabilité et le coût, pas de nouvelles
  fonctionnalités.
- **Risques** : c'est le palier où une dette d'architecture non traitée en
  Phase 1-3 devient très coûteuse à corriger (même leçon que 16-audit.md).
  Un audit complet doit précéder cette phase, pas seulement la suivre.
- **Gains attendus** : le coût d'accompagnement par membre baisse (effet
  d'échelle de l'automatisation), pendant que la qualité perçue reste
  stable ou monte.
- **Critère de sortie** : le ratio membres/directeur peut doubler par
  rapport à la Phase 2 sans baisse mesurée des scores de motivation
  moyens.

### Phase 5 — 50 000 membres

- **Prioritaire** : ce que 09 appelle la généralisation — GC Brain devient
  un cas d'usage du même socle que GC AI Factory (11), plutôt qu'un
  système parallèle. À ce stade, les deux volets de GC AI OS
  fusionnent réellement.
- **Risques** : le principal risque n'est plus technique, il est humain —
  maintenir une expérience qui « sait toujours quoi faire, jamais
  réfléchir » à cette échelle exige que le principe de priorisation sur
  le risque de l'inaction (17) reste juste, sinon le système notifie mal
  et perd la confiance de dizaines de milliers de personnes d'un coup.
- **Gains attendus** : Génération Capable dispose du système de pilotage
  le plus abouti du marché de la formation commerciale — un avantage
  défendable, pas seulement un argument marketing.
- **Critère de sortie** : ce n'est plus un critère technique, c'est un
  critère de marché — la rétention à 6 mois d'un membre dépasse durablement
  ce qui est observé chez les concurrents identifiés par Research Agent
  (03).

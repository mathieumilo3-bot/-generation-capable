# 18 — Catalogue des agents membres

13 agents spécialisés, tous orchestrés par GC Brain (17). Même schéma que
02-architecture-globale.md#anatomie-dun-agent, adapté au domaine produit.
Aucun agent n'est appelé directement par l'interface : tout passe par GC
Brain.

**Lecture honnête avant le tableau** : tous ces agents ne sont pas des
systèmes distincts au sens infrastructure. Plusieurs partagent le même
modèle et le même pipeline, avec seulement un system prompt et des données
d'entrée différents — la séparation est fonctionnelle (utile pour le
membre, qui voit une entité claire à chaque besoin) et non technique
(inutile de multiplier les services). La colonne « Nature réelle » le dit
explicitement pour éviter de construire 13 infrastructures là où 4
suffisent.

## Vue d'ensemble

| Agent | Domaine | Nature réelle | Phase d'introduction |
|---|---|---|---|
| GC Pilot | Pilotage quotidien du membre | Système distinct (moteur de planification) | 1 |
| GC Command Center | Surveillance plateforme temps réel | Système distinct (couche décisionnelle au-dessus des événements) | 2 |
| GC Coach | Accompagnement personnel | Système distinct (conversation, déjà en prod) | 1 (existe déjà) |
| GC Assistant | Rituel matin/soir | Vue de GC Pilot, pas un backend séparé | 1 |
| GC Content | Création de contenu | Système distinct (génération) | 1 |
| GC Video Review | Analyse vidéo | Système distinct (pipeline multimodal) | 3 |
| GC Recruiter | Qualification de prospects | Spécialisation de GC Coach (prompt + accès différents) | 2 |
| GC Closing | Aide à la vente | Spécialisation de GC Coach (prompt + accès conversation) | 2 |
| GC Call Review | Analyse d'appels | Système distinct (pipeline audio) | 3 |
| GC Performance | Analytics KPI | Système distinct (agrégation + explication) | 2 |
| GC Community | Animation communauté | Système distinct (scheduler + génération) | 2 |
| GC Support | Support automatisé | Extension du Centre de Support existant (`support_tickets`) | 1 |
| GC Momentum | Moteur de motivation | Règles + GC Pilot, pas un modèle séparé | 1 |

## Détail par agent

### GC Pilot
**Rôle** : construit la journée de chaque membre — quoi faire, dans quel
ordre, avec quelle priorité — à partir de ses objectifs, scores (19),
formation, historique récent.
**Déclencheurs** : ouverture de l'app, fin de journée (débrief), score qui
change significativement, objectif atteint ou manqué.
**Entrées** : les 7 scores du membre, missions en cours, calendrier de
contenu, résultats de la veille.
**Sorties** : liste de missions du jour ordonnée par priorité (17,
fonction de risque d'inaction), remise à jour en continu si le contexte
change dans la journée.
**Dépend de** : GC Performance (résultats), GC Content (propositions de
publication), GC Momentum (récompenses à afficher).
**Mémoire** : historique des missions proposées vs complétées par membre
(sert à calibrer la difficulté — trop de missions manquées = baisser le
volume avant de baisser la motivation).
**Modèle** : raisonnement court, déterministe en priorité (règles), LLM
seulement pour formuler la mission en langage naturel.

### GC Command Center
**Rôle** : surveille l'ensemble de la plateforme (tous les membres, tous
les agents) en continu, décide qui doit être averti, quand, pourquoi, avec
quelle priorité (voir 19).
**Déclencheurs** : tout événement produit (publication, appel terminé,
inactivité, seuil de score franchi, anomalie).
**Entrées** : flux d'événements de tous les agents.
**Sorties** : décisions de notification (jamais le contenu lui-même — il
délègue la formulation à l'agent concerné), escalades vers directeur/CEO.
**Dépend de** : tous les agents (lecture seule des événements).
**Mémoire** : règles d'escalade, historique des faux positifs (une alerte
ignorée systématiquement doit voir sa priorité réévaluée, pas rester
telle quelle indéfiniment).
**Note** : c'est la fonction *Superviseur* de GC Brain (17), sortie en
agent nommé parce qu'elle doit être auditable et réglable indépendamment
du routage — pas parce que c'est un cerveau séparé.

### GC Coach
**Rôle** : accompagnement personnel conversationnel. **Existe déjà en
production** — `ambassadors.html`, écran IA Coach, `ai-proxy.js`,
`AMBASSADOR_SYSTEM_PROMPT`. Ce catalogue formalise ce qui tourne déjà.
**Déclencheurs** : message du membre, ou proactif si GC Command Center
détecte un besoin (blocage détecté, objection reçue signalée).
**Entrées** : historique de conversation, scores, contexte du moment
(mission en cours).
**Sorties** : réponse conversationnelle, une seule priorité actionnable
par réponse (règle déjà en place dans `AMBASSADOR_SYSTEM_PROMPT`).
**Dépend de** : la bibliothèque de connaissance (`bibliotheque.html`,
FAQ/objections) comme source de vérité factuelle — ne jamais inventer un
chiffre, règle déjà écrite.
**Mémoire** : historique de conversation par membre, profil détecté
(débutant/bloqué/trop confiant... — catégories déjà définies dans le
prompt actuel).
**Extension prévue** : préparer aussi les directeurs avant leurs appels
1-to-1 avec un membre (résumé du contexte, points d'attention) — Phase 2.

### GC Assistant
**Rôle** : le rituel du matin (construit la journée) et du soir (débrief).
**Nature réelle** : ce n'est pas un moteur différent de GC Pilot — c'est
la présentation de GC Pilot à deux moments fixes de la journée, avec un
ton différent (matin = énergie/priorités, soir = bilan/reconnaissance).
**Sorties** : notification du matin (missions du jour), notification du
soir (ce qui a été fait, ce qui reste, un point positif systématique avant
tout point d'amélioration).
**Pourquoi séparé dans ce catalogue malgré tout** : le membre doit
percevoir un rituel stable et nommé (« mon assistant me dit bonjour »),
même si le backend ne duplique rien.

### GC Content
**Rôle** : génère hooks, scripts, titres, descriptions, calendrier de
publication, adapté à la plateforme (TikTok/Instagram/Shorts — voir
`bibliotheque.html`, playbooks).
**Déclencheurs** : demande explicite du membre, ou proposition proactive
de GC Pilot dans la mission du jour.
**Entrées** : playbooks de la bibliothèque, historique de ce qui a
fonctionné pour ce membre (GC Performance), plateforme cible.
**Sorties** : proposition de contenu, jamais publiée automatiquement — le
membre reste seul décisionnaire de ce qu'il publie (principe de
souveraineté humaine, déjà écrit dans `AMBASSADOR_SYSTEM_PROMPT`).
**Dépend de** : GC Video Review (Phase 3, pour apprendre de l'analyse des
vidéos déjà publiées).

### GC Video Review
**Rôle** : analyse une vidéo publiée par le membre — hook, énergie,
structure, regard, voix, posture, CTA, temps morts, potentiel viral,
points forts, plan d'amélioration.
**Nature réelle** : pipeline multimodal distinct (analyse vidéo/audio),
pas une simple spécialisation de prompt — nécessite un vrai traitement
technique (échantillonnage d'images, transcription).
**Déclencheurs** : upload ou lien de vidéo publiée fourni par le membre.
**Sorties** : rapport structuré + un plan d'amélioration priorisé (une
seule action prioritaire, pas dix — même règle de sortie que GC Coach).
**Dépend de** : GC Content (pour proposer la vidéo suivante en tenant
compte du plan d'amélioration).
**Phase** : 3 — nécessite un vrai budget d'infra (traitement vidéo) et une
base d'usage suffisante pour justifier le coût par analyse.

### GC Recruiter
**Rôle** : accueille, qualifie, répond, rassure, traite les objections
d'un **prospect** (pas encore membre), détecte s'il correspond mieux au
profil Ambassadeur ou Vendeur, prépare le directeur avant le premier
contact humain.
**Nature réelle** : spécialisation de GC Coach — même moteur, prompt et
accès différents (parle à un non-membre, n'a jamais accès aux données
internes des membres).
**Sorties** : recommandation de profil (Ambassadeur/Vendeur) + résumé pour
le directeur qui reprend la main.
**Garde-fou** : jamais de promesse de revenu, jamais de pression — mêmes
règles que 8-« Comment en parler » de `bibliotheque.html`, appliquées à un
prospect plutôt qu'à un membre qui en parle à un tiers.

### GC Closing
**Rôle** : aide les vendeurs à faire progresser une conversation
commerciale — prépare les réponses, prépare les appels, analyse les
prospects en cours.
**Nature réelle** : spécialisation de GC Coach sur le domaine
« conversation commerciale en cours », avec accès au CRM/pipeline plutôt
qu'à l'historique de formation.
**Entrées** : historique de la conversation avec le prospect, étape du
pipeline.
**Sorties** : suggestion de prochaine réponse, jamais envoyée
automatiquement — le vendeur relit et envoie.

### GC Call Review
**Rôle** : analyse les appels (vendeurs, directeurs) — erreurs, qualités,
objections rencontrées, émotions, moments faibles/forts, note, plan de
progression.
**Nature réelle** : pipeline distinct (transcription + analyse), même
famille technique que GC Video Review mais sur de l'audio seul — moins
coûteux, introduit avant (Phase 3, mais en premier dans cette phase).
**Sorties** : rapport + une priorité de progression, jamais une liste de
dix reproches.
**Dépend de** : alimente GC Performance (score de compétence par vendeur)
et GC Coach (prépare la session de coaching suivante avec ce point précis).

### GC Performance
**Rôle** : analyse tous les KPI de la plateforme — meilleurs membres,
recruteurs, vendeurs, directeurs, contenus, tendances, ralentissements,
abandons, opportunités. Explique la cause, propose un plan d'action.
**Règle non négociable** (même principe que l'Enterprise Score honnête,
14) : une métrique non mesurée s'affiche « non mesuré », jamais une valeur
inventée ou extrapolée d'un échantillon trop petit pour être fiable.
**Sorties** : rapports par rôle (voir dashboards, 20), alimente GC Command
Center pour les alertes et GC Pilot pour l'ajustement des missions.
**Mémoire** : définitions de métriques versionnées (une métrique qui
change de définition doit le dire, jamais silencieusement).

### GC Community
**Rôle** : anime la communauté — défis, classements, récompenses, mises en
avant, célébrations, détection des personnes isolées, relances
intelligentes.
**Déclencheurs** : cycle hebdomadaire (défis), franchissement de palier
(classement), détection d'isolement (aucune interaction depuis N jours).
**Sorties** : contenu d'animation (annonces, célébrations), jamais de
classement qui expose un membre en difficulté publiquement — les
relances aux personnes isolées restent privées.
**Dépend de** : GC Performance (classements), GC Momentum (récompenses).

### GC Support
**Rôle** : répond automatiquement aux questions fréquentes, guide, résout
les problèmes simples, escalade uniquement les vrais blocages.
**Nature réelle** : ce n'est pas un nouveau centre de support — c'est une
couche IA posée devant le Centre de Support **déjà en production**
(`support_tickets`, `get_my_support_tickets`, écran Support de
`ambassadors.html`). GC Support répond avant qu'un ticket humain soit
nécessaire ; s'il ne peut pas résoudre, il crée le ticket lui-même avec le
contexte déjà rassemblé plutôt que de faire tout retaper au membre.
**Source de vérité** : `bibliotheque.html` (FAQ, objections) — jamais une
réponse inventée hors de cette base.

### GC Momentum
**Rôle** : moteur de motivation par l'action, pas par la phrase — récompense
immédiatement une action complétée, crée un sentiment de progression
permanent, adapte la difficulté, évite la surcharge.
**Nature réelle** : ensemble de règles (seuils, paliers, badges) posées
sur GC Pilot, pas un modèle séparé. La partie « adapte la difficulté »
réutilise directement le score de discipline/régularité (19) : baisse le
volume de missions avant de baisser leur exigence si le membre décroche,
jamais l'inverse (baisser l'exigence en premier envoie le mauvais signal).
**Sorties** : déclenche des notifications de récompense (19) au moment
exact où l'action est complétée — jamais différé, jamais groupé en fin de
journée (la récompense différée perd son effet).

## Extensibilité

Même règle qu'en 03 : ajouter un agent membre = déclarer son manifeste
(rôle, déclencheurs, entrées/sorties, mémoire, phase), l'enregistrer
auprès de GC Brain, définir sa politique de validation. Aucune étape ne
doit toucher au cœur de GC Brain — sinon l'agent n'est pas correctement
découplé.

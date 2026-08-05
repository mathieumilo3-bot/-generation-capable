# 17 — GC Brain : le système IA de la plateforme membres

## Positionnement — à lire avant tout le reste

Ce document ouvre un deuxième volet de GC AI OS, distinct de celui décrit
dans 01-16. Il faut être explicite sur la différence, sinon les deux se
mélangent silencieusement :

| | **GC AI OS** (docs 01-16) | **GC Brain** (ce volet, 17-21) |
|---|---|---|
| Pilote | Génération Capable **l'entreprise** (dev, marketing, vente, support, finance) | Génération Capable **le produit** — l'expérience des membres (ambassadeurs, vendeurs, directeurs, CEO) |
| Utilisateurs | L'équipe fondatrice et les futurs employés IA internes | Les ambassadeurs, vendeurs, directeurs — au quotidien, dans l'app |
| Où ça vit aujourd'hui | Repository séparé `gc-ai-os` (Next.js, encore ~20 % réel — voir 16-audit.md) | Ce repository (`generation-capable`) : Netlify Functions + Supabase, déjà en production |
| Agents existants | CEO, CTO, Frontend, Backend... (19 agents internes, catalogue 03) | GC Pilot, GC Coach, GC Content... (catalogue 18) |

**Ce ne sont pas deux cerveaux concurrents.** L'architecture retenue en 02
(Orchestrateur + agents spécialisés, mémoire partagée, RBAC, bus
d'événements) est correcte et se généralise très bien à un deuxième
domaine. GC Brain est donc **le même patron d'architecture que
l'Orchestrateur de 02, appliqué à un nouveau domaine : « produit / membre »
plutôt que « entreprise interne »** — pas un système réécrit de zéro.

Ce qui diffère, et justifie un document séparé plutôt qu'une simple ligne
ajoutée au tableau de 03 :
- L'échelle est différente de plusieurs ordres de grandeur : 19 agents
  internes servent une poignée d'employés ; GC Brain doit servir de 15 à
  50 000 membres simultanément (voir roadmap, 20).
- Le rythme est différent : les agents internes traitent des tâches
  (heures/jours) ; GC Brain doit répondre en quasi temps réel, en continu,
  toute la journée, pour chaque membre.
- La donnée est différente : mémoire d'entreprise (documents, décisions)
  contre mémoire personnelle par membre (scores, habitudes, historique de
  contenu) — cloisonnement RLS strict entre membres, jamais entre agents
  internes.
- La réalité d'implémentation est différente : GC AI OS interne est encore
  largement à l'état de plan (16-audit.md). GC Brain, lui, a **déjà un
  premier agent réel en production** — l'IA Coach de `ambassadors.html`
  (`ai-proxy.js`, `AMBASSADOR_SYSTEM_PROMPT`) — ce qui change complètement
  le point de départ et la stratégie de déploiement (voir 20-roadmap).

**Conséquence directe pour la suite de ce document** : GC Brain ne
présuppose pas que le monorepo `gc-ai-os` (Orchestrateur, RBAC générique,
bus d'événements) soit terminé. Il réutilise les mêmes *principes*, mais
Phase 1 (voir 20) est construite directement dans ce repository, sur la
stack qui tourne déjà (Netlify Functions + Supabase), en étendant le
pattern déjà validé par l'IA Coach. La convergence vers le monorepo
`gc-ai-os` est un objectif de Phase 3, pas un prérequis de Phase 1 — répéter
l'erreur inverse (attendre un socle générique avant de livrer une seule
vraie fonctionnalité) est exactement le risque que 01 et 09 mettent déjà en
garde.

## Vision

Un membre de Génération Capable — ambassadeur, vendeur, directeur ou CEO —
doit toujours savoir, sans jamais avoir à y réfléchir :

**quoi faire · pourquoi · quand · comment · avec quelle priorité.**

Le but n'est pas de remplacer le membre, le directeur ou le CEO. C'est de
supprimer la charge mentale qui les empêche d'agir : le moment de blocage
(« je ne sais pas par où commencer »), la procrastination (« je le ferai
plus tard »), la perte de motivation (« je ne vois pas si ça sert à
quelque chose »). GC Brain ne fait pas le travail à la place du membre —
il élimine tout ce qui n'est pas le travail lui-même.

## GC Brain — architecture

### Ce qu'il est

GC Brain est l'Orchestrateur de 02, instancié pour le domaine
« produit / membre ». Trois responsabilités, identiques à celles de
l'Orchestrateur — la duplication de définition ci-dessous est volontaire,
pour que ce document reste lisible seul, mais le contrat est le même :

1. **Router** — reçoit un événement (ouverture d'app, fin de vidéo
   publiée, message reçu, appel terminé, inactivité détectée, demande
   explicite du membre) et détermine quel(s) agent(s) spécialisés
   traitent la demande. Le routage se fait par métadonnées de capacité
   déclarées par chaque agent (18), jamais par un unique prompt géant qui
   « devine » tout.
2. **Planner** — pour un événement qui touche plusieurs agents (ex. : une
   vidéo publiée déclenche à la fois GC Video Review, GC Content pour la
   suivante, et potentiellement GC Momentum pour la récompense), construit
   la séquence et les dépendances.
3. **Superviseur** — suit l'exécution, décide si un résultat doit remonter
   comme notification (voir 19), s'assure qu'aucun agent ne parle au
   membre de façon contradictoire avec un autre.

**GC Brain n'exécute jamais lui-même de logique métier.** Il ne rédige pas
de script TikTok, il ne note pas un appel — il décide *qui* le fait, dans
quel ordre, et avec quelle priorité de restitution. La logique métier vit
dans les agents (18).

### Mémoire

Deux couches, jamais mélangées :

- **Mémoire par membre** (privée, RLS stricte — un membre ou un directeur
  qui n'a pas explicitement le droit ne peut jamais lire les données d'un
  autre membre) : les 7 scores (19), l'historique de contenu publié, les
  conversations avec GC Coach, les objectifs personnels, les préférences
  observées (rythme, canal préféré, ton qui fonctionne — même logique que
  Human Brain, 15, appliquée au membre plutôt qu'au fondateur).
- **Mémoire partagée produit** (accessible en lecture agrégée par les
  agents, jamais nominative sauf pour les rôles habilités — directeur,
  CEO) : bibliothèque de contenus qui fonctionnent (études de cas, voir
  `bibliotheque.html` section 19), objections et réponses validées,
  playbooks, systèmes. C'est la même bibliothèque de connaissance que
  celle déjà écrite dans `bibliotheque.html` et dans
  `AMBASSADOR_SYSTEM_PROMPT` — GC Brain ne la duplique pas, il la lit.

Aucun agent n'a de mémoire privée qui lui est propre et invisible aux
autres : un membre qui parle à GC Coach le lundi et à GC Assistant le mardi
doit retrouver le même contexte, jamais recommencer à zéro.

### Permissions (RBAC produit)

| Rôle | Peut voir | Ne peut jamais voir |
|---|---|---|
| Membre (ambassadeur/vendeur) | Ses propres scores, son historique, ses notifications | Les données d'un autre membre (sauf classements agrégés anonymisables, voir 19) |
| Directeur des Ambassadeurs | Les scores agrégés + nominatifs de son équipe d'ambassadeurs | Les données financières globales, les scores des vendeurs hors périmètre |
| Directeur Commercial | Les scores agrégés + nominatifs de son équipe de vendeurs | Les décisions stratégiques réservées CEO |
| CEO | Vue globale agrégée + accès nominatif sur escalade uniquement | — (accès complet, mais l'Enterprise Score reste honnête : « non mesuré » plutôt qu'inventé, même règle que 14) |

Toute action qui écrit une donnée financière (déclenchement de commission,
changement de statut d'abonnement) reste une action *critique* au sens de
06-securite.md : jamais exécutée par un agent produit sans passer par les
mêmes garde-fous que le reste de GC AI OS (aujourd'hui : RLS Supabase +
fonctions serverless qui vérifient le token, voir `ambassador-data.js`).

### Comment GC Brain choisit quelle IA appeler

Chaque agent (18) déclare ses **déclencheurs** (quels événements il traite)
et son **domaine** (quel type de décision il prend). GC Brain ne fait
jamais de routage « au jugé » par LLM seul sur une tâche à fort impact
(ex. : décider qui reçoit une commission) — le routage déterministe
(table de règles) est préféré au routage par modèle partout où c'est
possible ; le modèle est réservé à la génération de contenu et à
l'analyse, jamais à la décision d'accès ou d'argent (même principe que le
Decision Engine de 14, appliqué ici à plus petite échelle).

### Comment il apprend

Même mécanique que la télémétrie de compétences (12) : chaque
recommandation de GC Brain (« publie maintenant », « ce hook a un fort
potentiel ») est comparée après coup à ce qui s'est réellement passé
(vues, conversions, réponse du membre). Le score de fiabilité par type de
recommandation évolue avec un lissage de Laplace, jamais par sur-réaction
à un seul cas.

### Comment il priorise

La leçon de l'audit 16 (point 5 : « le scoring ignore le risque de
l'inaction ») s'applique directement ici et est corrigée dès la
conception : une notification n'est jamais priorisée uniquement sur le
risque de l'action proposée, mais sur l'écart entre le risque d'agir et
le risque de ne rien faire. Un membre inactif depuis 5 jours a un risque
d'inaction élevé (désengagement, churn) même si l'action proposée
(« publie une vidéo ») est individuellement anodine — c'est cet écart qui
détermine la priorité, pas la vidéo en elle-même.

### Comment il protège les données

RLS Supabase (déjà en place dans ce repository — voir les migrations
`0001_subscribers_roles_and_rls.sql` et suivantes) reste la seule source
de vérité pour l'isolation des données. GC Brain ne réimplémente pas de
contrôle d'accès applicatif parallèle : toute lecture passe par une
requête qui respecte RLS, jamais par une clé de service exposée
côté client (cette règle est déjà appliquée par `ambassador-data.js`,
qui exige un token de session valide — voir le correctif du 03/08 cité
dans `ambassadors.html`).

## Principe non négociable : aucune IA ne travaille seule

Toute réponse produite par un agent (18) passe par GC Brain avant
d'atteindre le membre, pour deux raisons :

1. **Cohérence** — GC Coach ne doit jamais dire « publie 3 fois cette
   semaine » pendant que GC Momentum dit « tu en as assez fait ». GC Brain
   est le seul point qui voit toutes les recommandations en cours pour un
   membre donné et arbitre avant restitution.
2. **Auditabilité** — comme pour l'Orchestrateur (02), toute décision qui
   touche un membre doit être reconstructible : quel agent, quelle donnée
   d'entrée, quelle sortie, à quelle heure.

Aucun agent n'appelle un autre agent directement. Un agent qui a besoin
d'une information produite par un autre la demande à GC Brain, qui
orchestre — jamais d'appel agent → agent en direct, même règle que 02.

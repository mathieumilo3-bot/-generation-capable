# gc-ai-os

GC AI OS — Orchestrateur et 19 agents IA spécialisés pilotant Génération
Capable. Fondation de GC AI Factory.

La documentation d'architecture (vision, décisions, comparatifs justifiés)
vit dans le repository `-generation-capable`, sous `docs/gc-ai-os/`. Ce
dossier en est l'implémentation de phase 1 (voir
`docs/gc-ai-os/09-roadmap.md`) — toute divergence entre ce code et la
documentation d'architecture doit être résolue en mettant l'un ou l'autre
à jour explicitement, jamais laissée en silence.

**État réel, pas une promesse** : ce n'est pas une maquette. Le système
est **orienté objectifs**, pas seulement conversationnel — on lui donne un
but (« amener Génération Capable à 10 000 clients »), il le décompose en
missions, les affecte aux agents, les exécute en parallèle, se corrige,
valide, et produit un **dossier téléchargeable**. Tout cela fonctionne dès
`pnpm install && pnpm dev`, sans aucune configuration. Ce qui est simulé
(la rédaction de fond, tant qu'aucune clé de modèle n'est fournie) est
annoncé comme tel par l'application elle-même, jamais présenté comme réel
quand il ne l'est pas.

## L'étage exécutif

Onglet **Direction** (vue d'accueil) : note d'entreprise par département,
priorité du jour argumentée, constat des 8 Executive Brains, et lacunes
d'instrumentation — plus le briefing téléchargeable.

**Le Directeur Général et les Executive Brains ne sont pas des LLM.**
Huit modèles qui « débattent » n'échantillonnent qu'une seule
distribution : on paie huit appels pour le théâtre de la délibération.
Ce qui distingue un CFO d'un CMO, c'est la donnée qu'il regarde, pas son
tempérament. Les Brains sont donc des analystes instrumentés, et
l'arbitrage est calculé — reproductible, gratuit, explicable.

**Aucun chiffre n'est inventé.** `value: null` signifie « non mesuré » et
traverse tout le système jusqu'à l'écran. Un département sans données
affiche « non mesuré », jamais 0 ; et la note globale reste masquée tant
que moins de la moitié des départements sont notables — une moyenne sur
un département donnerait une fausse impression de maîtrise.

Mécanisme central : la **confiance** d'une proposition dérive des données
qui la fondent (0,25 sans preuve, 0,80 avec). Résultat observé en
fonctionnement — sans données, la priorité du système devient
« branche cette source » ; dès qu'on lui donne un taux de résiliation
réel, il bascule sur « enraye la résiliation avant d'investir en
acquisition ».

## Le pipeline

```
Objectif → Planification → Missions → Affectation (Directeur Général)
        → Exécution parallèle → Auto-correction → Validation → Livraison
```

Trois garde-fous rendent l'autonomie acceptable en entreprise : **budget
dur** (le Directeur Général interrompt à l'épuisement), **plafond de
tentatives** (pas de boucle infinie), **RBAC et escalade** (aucune action
critique exécutée sans validation humaine).

## Démarrer

```bash
cd apps/web
pnpm install
pnpm dev
```

Ouvrir <http://localhost:3000>. C'est tout — aucune base de données à
provisionner, aucun service externe à configurer. Un fichier
`apps/web/.data/gc-ai-os.sqlite` est créé automatiquement au premier
démarrage (persistance locale, voir plus bas).

### Activer les vraies réponses des agents

Sans clé de modèle, le chat répond en mode démonstration hors-ligne et le
dit explicitement — le routage, la vérification RBAC et la journalisation
d'audit tournent quand même réellement. Pour obtenir de vraies réponses
générées par un modèle :

```bash
cp apps/web/.env.example apps/web/.env.local
# éditer apps/web/.env.local et renseigner ANTHROPIC_API_KEY
pnpm dev
```

## Les 19 agents

CEO (généraliste, domaine par défaut), CTO, Frontend, Backend, Supabase,
DevOps, QA, Marketing, Commercial, Support, Finance, Content, Research,
Data, Legal & Compliance, Automation, Security, Customer Success,
Recruitment — un package par agent sous `packages/agents/`, chacun
conversationnel dès aujourd'hui (voir `docs/gc-ai-os/03-agents.md` pour
le rôle et les responsabilités détaillés de chacun).

Chaque agent connaît le contexte réel de Génération Capable
(`packages/agents-core/src/business-context.ts`, extrait des fichiers de
production fournis : `index.html`, `ai-proxy.js`, `ambassador-data.js`) —
modèle Académie gratuite + abonnement Pro à 67 €/mois, commissions
vendeurs/ambassadeurs, standard de coaching du GC Cognitive Engine™
existant. Il lui est explicitement interdit d'inventer un chiffre ou une
fonctionnalité hors de ce contexte.

## Structure

```
apps/
  web/                     # Interface de chat Next.js + API /api/chat
packages/
  shared-types/             # Types partagés : Agent, Task, Connector, mémoire, sécurité
  model-provider/            # Couche modèle : AnthropicModelProvider + FallbackModelProvider
  agents-core/                # BaseAgent, ConversationalAgent, contexte métier, registre d'agents
  agents/                       # Un package par agent — voir "Les 19 agents" ci-dessus
    ceo-agent/  cto-agent/  frontend-agent/  backend-agent/  supabase-agent/
    devops-agent/  qa-agent/  marketing-agent/  commercial-agent/  support-agent/
    finance-agent/  content-agent/  research-agent/  data-agent/  legal-agent/
    automation-agent/  security-agent/  customer-success-agent/  recruitment-agent/
  connectors/                    # ConnectorGateway (point de passage RBAC obligatoire) + GitHub, Stripe
  memory/                          # Client de mémoire versionnée + recherche sémantique
  security/                          # AuthorizationService (RBAC deny-by-default) + audit
  orchestrator/                        # Router (mots-clés) / planner / superviseur / handleMessage
  runtime/                               # Assemblage : store SQLite local + bootstrap de l'Orchestrateur
supabase/
  migrations/                             # Schéma de référence (même forme que le store SQLite local)
```

Chaque `packages/agents/<nom>-agent` dépend de `agents-core` et
`model-provider`, jamais l'inverse — un agent doit pouvoir être supprimé
ou remplacé sans casser le reste du système.

## Les deux décisions d'architecture qui comptent

**Le Directeur Général n'est pas un LLM.** C'est un moteur de politique
déterministe alimenté par la télémétrie réelle des agents. Un modèle sur
le chemin critique de chaque affectation ajouterait latence, coût et
surtout imprévisibilité à une décision qui doit être reproductible et
explicable (« pourquoi cet agent ? » → une formule chiffrée, pas « le
modèle a estimé »). Le LLM garde le jugement qualitatif — rédiger un
plan, critiquer un livrable. Voir `docs/gc-ai-os/13-directeur-general.md`.

**La Factory ne génère pas de code.** Elle produit des manifestes
déclaratifs validés par schéma, chargés au démarrage. Un agent fabriqué
est une ligne en base : validable, versionnable, révocable, incapable
d'exécuter autre chose que ce que le RBAC lui accorde. C'est ce qui rend
la fabrique d'employés IA diffusable à des milliers d'organisations sans
exécuter du code non relu. Voir `docs/gc-ai-os/11-factory.md`.

## Ce qui tourne réellement aujourd'hui

- **Chat** : chaque message passe par l'Orchestrateur, qui route vers l'un
  des 19 agents selon des mots-clés (routage par domaine, voir
  `packages/runtime/src/bootstrap.ts` — CEO Agent est le domaine par
  défaut si aucun mot-clé plus spécifique ne correspond), vérifie la
  permission via `AuthorizationService` (deny-by-default, capacité
  `<agent>.converse`), fait générer une réponse (Anthropic si une clé est
  fournie, sinon un message honnête de démonstration), journalise le tour
  dans `audit_log`, et écrit un résumé dans `memory_entries`.
- **Sécurité active, pas décorative** : demander une action critique
  (« déploie ça en prod », « rembourse le client », « signe le contrat »)
  déclenche un refus explicite de l'agent concerné plutôt qu'une
  simulation d'action — chaque agent déclare ses propres motifs d'action
  critique (`criticalPatterns`).
- **Persistance locale réelle** (`packages/runtime`, SQLite via
  `node:sqlite`, sans dépendance externe) : tâches, permissions (19
  lignes RBAC, une par agent), journal d'audit et mémoire survivent à un
  redémarrage. Migrer vers Supabase Postgres (voir
  `supabase/migrations/0001_init.sql`, même structure) consiste à écrire
  une autre implémentation des mêmes interfaces (`TaskStore`,
  `PermissionStore`, `AuditSink`, `MemoryRepository`), pas à changer
  l'Orchestrateur ou les agents.

## Ce qui n'est pas encore implémenté

- Connecteurs réels au-delà des squelettes `GithubConnector` /
  `StripeConnector` (capacités déclarées, aucun appel externe n'est fait).
- Classification de domaine par modèle plutôt que par mots-clés — la
  règle par mot-clé est une approximation phase 1, documentée comme
  telle dans `bootstrap.ts` (ex. deux domaines proches peuvent se
  chevaucher sur un message ambigu).
- Vues Agents/Mémoire/Workflows/Outils/Monitoring/Logs/Performances du
  dashboard (voir `docs/gc-ai-os/07-interface.md`) — seule la vue Chat
  existe pour l'instant.
- Adaptateur Supabase réel pour `TaskStore`/`MemoryRepository`/etc.
  (aujourd'hui uniquement le store SQLite local).
- Peuplement complet de la mémoire métier (le contexte métier actuel est
  un socle codé en dur dans le prompt système, pas encore une mémoire
  versionnée et enrichissable — voir `docs/gc-ai-os/04-memoire.md`).

## Moteur d'objectifs, en pratique

Onglet **Objectifs** (vue par défaut) :

- **Planifier** — décompose sans rien exécuter. Le plan se relit avant
  d'engager du budget.
- **Planifier et exécuter** — lance les agents en parallèle par vagues de
  dépendances, avec auto-correction et validation, puis expose le dossier
  et chaque livrable au téléchargement.

API équivalente :

```bash
curl -X POST localhost:3000/api/objectives \
  -H 'content-type: application/json' \
  -d '{"title":"Amener Génération Capable à 10 000 clients","execute":true}'

curl -O -J localhost:3000/api/objectives/<id>/dossier   # le fichier .md
```

## Vérifié avant ce commit

`pnpm install`, `tsc --noEmit` sur les 31 packages, `next build`, puis
`next start` avec des exécutions réelles :

- **Objectif « Amener Génération Capable à 10 000 clients »** exécuté de
  bout en bout : 6 missions générées, affectées par le Directeur Général
  à 6 agents distincts (data, marketing ×2, commercial, recruitment,
  customer-success), toutes terminées, 6 livrables produits, dossier
  téléchargé (7 Ko, en-têtes `content-disposition` corrects). La cible
  chiffrée `10000` a été extraite automatiquement de l'énoncé.
- **Objectif « Refondre la plateforme technique »** : playbook différent
  correctement sélectionné, routage vers CEO/CTO/backend/QA/security.
- **Factory** : agent « Analyste de la performance des ambassadeurs
  TikTok » fabriqué, évalué (score 1,0), publié — puis **rechargé au
  redémarrage** et actif (20 agents au total, confirmé via `/api/agents`).
- **Télémétrie** : les compétences sont passées de 50 (démarrage à froid)
  à 67 après une exécution réussie — conforme au lissage de Laplace
  documenté, et non à une valeur écrite en dur.
- **Mémoire structurée** : 2 entrées `decision` et 11 `learning` écrites
  automatiquement, vérifiées directement en base.

Une amélioration a été faite pendant cette vérification : le livrable
produit hors-ligne était un écho inutilisable ; il est désormais une
fiche de travail structurée (mandat, critère, sections à compléter),
explicitement marquée comme non rédigée par un modèle.

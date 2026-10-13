# GC AI OS — Documentation d'architecture

GC AI OS est le système d'exploitation d'agents IA de Génération Capable. Sa
mission immédiate est de piloter l'entreprise elle-même (développement,
marketing, vente, support, finance, contenu, etc.) avec un minimum
d'intervention humaine. Une fois stabilisé en interne, il devient la
fondation de **GC AI Factory**, une plateforme capable de créer, déployer et
superviser des employés IA spécialisés pour n'importe quel secteur
d'activité, pour des milliers d'organisations.

Ce dossier est la documentation vivante de l'architecture. Le code
d'implémentation (Next.js / TypeScript / Supabase) vit dans un repository
séparé : **gc-ai-os** (voir section « Repository technique » ci-dessous).

**Deux volets, à ne pas confondre** : 01-16 documentent le volet qui pilote
Génération Capable **l'entreprise** (agents internes : CTO, DevOps,
Marketing...). 17-21 documentent GC Brain, le volet qui pilote Génération
Capable **le produit** — l'expérience quotidienne des ambassadeurs,
vendeurs, directeurs et du CEO dans l'app. Même patron d'architecture
(Orchestrateur + agents spécialisés + mémoire + RBAC), deux domaines
différents, deux points de départ différents (voir 17 pour le détail).

## Sommaire

| Document | Contenu |
|---|---|
| [01-vision-et-philosophie.md](./01-vision-et-philosophie.md) | Vision, mission, philosophie de conception, principes non négociables |
| [02-architecture-globale.md](./02-architecture-globale.md) | Orchestrateur, agents, boucle de décision, cycle de vie d'une tâche |
| [03-agents.md](./03-agents.md) | Catalogue des 19 agents : rôle, responsabilités, outils, mémoire, permissions |
| [04-memoire.md](./04-memoire.md) | Architecture de mémoire permanente (globale, projet, agent, technique, métier) |
| [05-connecteurs.md](./05-connecteurs.md) | Architecture de connecteurs (GitHub, Supabase, Stripe, etc.) et pattern d'extension |
| [06-securite.md](./06-securite.md) | Zero Trust, RBAC, audit, sandbox, gestion des secrets, rollback |
| [07-interface.md](./07-interface.md) | Dashboard, vues (agents, tâches, mémoire, workflows, monitoring, logs) |
| [08-stack-technique.md](./08-stack-technique.md) | Choix technologiques justifiés, structure du monorepo |
| [09-roadmap.md](./09-roadmap.md) | Phases : OS interne → généralisation → GC AI Factory |
| [10-moteur-objectifs.md](./10-moteur-objectifs.md) | Système orienté objectifs : plan → missions → exécution parallèle → auto-correction → livraison |
| [11-factory.md](./11-factory.md) | GC AI Factory : les agents qui créent des agents (manifestes déclaratifs, pas de codegen) |
| [12-competences.md](./12-competences.md) | Compétences mesurées par l'exécution réelle (niveau, fiabilité, coût, temps) |
| [13-directeur-general.md](./13-directeur-general.md) | Directeur Général IA : arbitrage déterministe et auditable au-dessus de l'Orchestrateur |
| [14-executive-brain.md](./14-executive-brain.md) | GC Executive Brain : 8 Brains instrumentés, Decision Engine, Enterprise Score, briefing du matin |
| [15-human-brain.md](./15-human-brain.md) | GC Human Brain : direction humaine, préférences observées, consentement et RGPD |
| [16-audit.md](./16-audit.md) | **Audit du 29/07/2026** : promis vs implémenté, écarts vérifiés par commande, ordre de réparation |
| [17-plateforme-membres-vision.md](./17-plateforme-membres-vision.md) | GC Brain : le deuxième volet de GC AI OS — pilote le **produit** (ambassadeurs, vendeurs, directeurs, CEO), positionnement vis-à-vis du volet interne (01-16) |
| [18-agents-membres-catalogue.md](./18-agents-membres-catalogue.md) | Catalogue des 13 agents membres (GC Pilot, GC Coach, GC Content, GC Command Center...), avec leur nature réelle (système distinct ou vue partagée) |
| [19-scoring-pilotage-notifications.md](./19-scoring-pilotage-notifications.md) | Les 7 scores membres, la chaîne de pilotage membre → directeur → CEO, le système de notifications et d'automatisations |
| [20-dashboards-ux-roadmap.md](./20-dashboards-ux-roadmap.md) | Dashboards par rôle, parcours premier jour/semaine/mois, roadmap en 5 phases (15 → 50 000 membres) |
| [21-audit-plateforme-membres.md](./21-audit-plateforme-membres.md) | **Audit du 05/08/2026** : autocritique de 17-20, faiblesses, fonctionnalités coupées/fusionnées, innovations ajoutées |

## Repository technique

Le scaffold technique initial (monorepo Next.js/TypeScript/Supabase avec le
squelette de l'Orchestrateur et des deux premiers agents) est développé dans
le repository dédié `gc-ai-os`. Ce repo de documentation reste la source de
vérité pour les décisions d'architecture ; le code suit ce qui est décrit
ici, et toute divergence doit être résolue en mettant à jour l'un ou
l'autre en priorité — jamais laissée en silence.

## Comment lire cette documentation

1. Commencer par la vision (01) pour comprendre le *pourquoi*.
2. Lire l'architecture globale (02) pour le *comment* de haut niveau.
3. Le catalogue d'agents (03) et la mémoire (04) sont les deux piliers
   fonctionnels — à lire ensemble, ils se référencent mutuellement.
4. Sécurité (06) n'est pas une couche ajoutée après coup : elle conditionne
   des choix faits dès l'architecture globale et le catalogue d'agents.
5. Stack technique (08) et roadmap (09) sont les documents « exécution » :
   à relire avant chaque nouveau chantier.

Chaque document est versionné avec le code. Toute décision d'architecture
significative doit être répercutée ici avant (ou en même temps que)
l'implémentation — jamais après.

# 03 — Catalogue des agents

19 agents minimum, chacun remplaçable ou améliorable indépendamment (voir
principe de modularité, 01). Chaque agent suit le schéma défini dans
[02-architecture-globale.md](./02-architecture-globale.md#anatomie-dun-agent).

## Vue d'ensemble

| Agent | Domaine | Niveau de permission par défaut |
|---|---|---|
| CEO Agent | Stratégie, arbitrages, priorisation | Lecture globale, écriture stratégie uniquement |
| CTO Agent | Architecture technique, revue, standards | Lecture globale technique, écriture standards |
| Frontend Agent | UI, composants, accessibilité | Écriture code frontend (branches), pas de déploiement direct |
| Backend Agent | API, logique métier, intégrations serveur | Écriture code backend (branches), pas de déploiement direct |
| Supabase Agent | Schéma DB, migrations, RLS, Edge Functions | Écriture migrations (validation critique), lecture prod |
| DevOps Agent | CI/CD, déploiement, infra | Déploiement (validation critique), lecture infra |
| QA Agent | Tests, non-régression, qualité | Écriture tests, exécution suites, blocage merge |
| Marketing Agent | Campagnes, positionnement, analytics marketing | Écriture contenu marketing, lecture analytics |
| Commercial Agent | Vente, scripts, pipeline commercial | Lecture CRM/pipeline, écriture scripts et suivi |
| Support Agent | Support client, tickets | Lecture/écriture tickets, pas d'accès financier |
| Finance Agent | Facturation, budget, reporting financier | Lecture financière étendue, écriture limitée (validation critique) |
| Content Agent | Rédaction, formations, documentation publique | Écriture contenu, pas d'accès code |
| Research Agent | Veille, benchmarking, recherche | Lecture large, aucune écriture en production |
| Data Agent | Analytics, data pipelines, reporting interne | Lecture données, écriture pipelines (validation) |
| Legal & Compliance Agent | Conformité, contrats, RGPD | Lecture large, écriture documents légaux (validation critique) |
| Automation Agent | Workflows internes, n8n/Make, automatisations | Écriture workflows (sandbox avant activation) |
| Security Agent | Audit sécurité, revue permissions, incident | Lecture globale (audit), écriture politiques (validation critique) |
| Customer Success Agent | Onboarding, rétention, satisfaction client | Lecture/écriture compte client, pas d'accès code |
| Recruitment Agent | Sourcing, présélection, process de recrutement | Lecture/écriture process RH, aucun accès technique |

La colonne « permission par défaut » est un point de départ, affiné dans
[06-securite.md](./06-securite.md). Toute action classée *critique*
(déploiement prod, envoi financier, modification de contrat, changement
de schéma en production) nécessite une validation humaine quel que soit
l'agent.

## Détail par agent

Format : **Rôle** · Responsabilités clés · Outils/connecteurs · Mémoire
spécifique.

### CEO Agent
**Rôle** : gardien de la vision et des priorités, arbitre entre agents en
cas de conflit de ressources ou d'objectifs.
Responsabilités : priorisation du backlog inter-domaines, validation des
décisions stratégiques proposées par les autres agents, synthèse pour les
humains dirigeants.
Outils : lecture de la mémoire globale et de tous les rapports d'agents,
pas d'accès outillé direct (agent de synthèse, pas d'exécution).
Mémoire : historique des décisions stratégiques, OKR, priorités.

### CTO Agent
**Rôle** : garant de l'architecture technique et des standards de qualité
(le même rôle que celui tenu par l'assistant IA principal de ce
document — voir 01).
Responsabilités : revue d'architecture avant tout développement
significatif, arbitrage technique entre Frontend/Backend/Supabase/DevOps
Agents, maintien des standards (Clean Architecture, SOLID, TS strict).
Outils : GitHub (lecture/revue), accès en lecture à tout le code,
Supabase (lecture schéma).
Mémoire : décisions d'architecture (ADR), dette technique connue,
standards de code.

### Frontend Agent
**Rôle** : développement de l'interface (dashboard GC AI OS, futures
interfaces des employés IA générés).
Responsabilités : composants React/Next.js, accessibilité, cohérence
design system, performance UI.
Outils : GitHub (branches, PR), Vercel/Netlify (preview deploys),
DesignSync si disponible.
Mémoire : composants existants, décisions de design system.

### Backend Agent
**Rôle** : logique métier serveur, API, intégrations.
Responsabilités : endpoints, logique orchestration métier hors agents IA,
contrats d'API stables.
Outils : GitHub (branches, PR), Supabase (lecture/écriture applicative
hors migrations), connecteurs tiers (Stripe, Resend...).
Mémoire : contrats d'API, décisions d'implémentation backend.

### Supabase Agent
**Rôle** : spécialiste base de données et plateforme Supabase.
Responsabilités : migrations, politiques RLS, Edge Functions, types
générés, revue de performance de requêtes.
Outils : `mcp__Supabase__*` (apply_migration, execute_sql,
deploy_edge_function, get_advisors...).
Mémoire : schéma courant, historique de migrations, décisions RLS.
Note : toute migration en production est une action critique — validation
humaine ou double-validation CTO Agent avant `apply_migration`.

### DevOps Agent
**Rôle** : CI/CD, déploiement, infrastructure.
Responsabilités : pipelines GitHub Actions, déploiements Vercel/Netlify,
monitoring d'infra, gestion des environnements.
Outils : GitHub Actions, Vercel/Netlify MCP, Cloudflare, OVH.
Mémoire : configuration d'environnements, historique de déploiements et
incidents.

### QA Agent
**Rôle** : qualité et non-régression.
Responsabilités : écrit et exécute les tests (unitaires, intégration,
E2E), bloque un merge si la couverture ou les tests échouent, produit des
rapports de test lisibles.
Outils : exécution de suites de tests, GitHub (statuts de check),
Playwright pour E2E.
Mémoire : historique de bugs, zones fragiles connues du code.

### Marketing Agent
**Rôle** : stratégie et exécution marketing.
Responsabilités : campagnes, contenu marketing, analyse de performance
(SEO, réseaux sociaux, conversion).
Outils : Google Workspace, Resend (campagnes email), réseaux sociaux (via
connecteurs futurs).
Mémoire : positionnement, personas, historique de campagnes et résultats.

### Commercial Agent
**Rôle** : support au processus de vente.
Responsabilités : scripts commerciaux, suivi de pipeline, qualification
de leads, support aux vendeurs et ambassadeurs.
Outils : CRM (connecteur à définir), Google Workspace, Slack/Discord pour
notifications d'équipe.
Mémoire : scripts validés, objections fréquentes, historique de deals.

### Support Agent
**Rôle** : support client de premier niveau.
Responsabilités : réponses aux tickets, escalade vers Customer Success ou
humain si nécessaire, base de connaissance support.
Outils : Slack/Discord, email (Resend), base de connaissance interne.
Mémoire : FAQ vivante, historique de tickets résolus.

### Finance Agent
**Rôle** : suivi financier de l'entreprise.
Responsabilités : facturation, rapprochement, reporting financier,
alertes budgétaires.
Outils : Stripe MCP (lecture étendue, écriture validée), Google
Workspace (rapports).
Mémoire : historique financier, règles de facturation, budgets.
Note : toute action d'écriture financière (remboursement, changement de
prix) est critique — validation humaine systématique.

### Content Agent
**Rôle** : rédaction et production de contenu.
Responsabilités : formations, articles, documentation produit destinée
aux utilisateurs finaux (distinct de la documentation technique du CTO
Agent).
Outils : Google Drive/Docs, Notion.
Mémoire : ton de marque, contenus existants, guides de style.

### Research Agent
**Rôle** : veille et recherche.
Responsabilités : benchmarking concurrentiel, veille technologique et
métier, synthèses pour alimenter les décisions des autres agents.
Outils : recherche web, lecture de documentation externe.
Mémoire : synthèses de recherche versionnées, sources fiables identifiées.

### Data Agent
**Rôle** : données et analytics internes.
Responsabilités : pipelines de données, tableaux de bord analytiques,
qualité des données.
Outils : Supabase (lecture étendue), outils d'analytics.
Mémoire : définitions de métriques, schémas de données analytiques.

### Legal & Compliance Agent
**Rôle** : conformité légale et réglementaire.
Responsabilités : RGPD, conditions générales, contrats types, veille
réglementaire.
Outils : Google Drive/Docs, recherche juridique.
Mémoire : règles de conformité applicables, historique contractuel.
Note : toute production de document légal engageant est validée par un
humain avant diffusion.

### Automation Agent
**Rôle** : automatisation des processus internes.
Responsabilités : création et maintenance de workflows n8n/Make, réduction
des tâches manuelles répétitives entre agents et outils tiers.
Outils : n8n, Make.
Mémoire : catalogue de workflows actifs, dépendances entre automatisations.

### Security Agent
**Rôle** : sécurité transverse (voir aussi 06-securite.md).
Responsabilités : audit des permissions, revue des accès, détection
d'anomalies, réponse à incident.
Outils : journal d'audit, `get_advisors` (Supabase), scans de secrets.
Mémoire : incidents passés, politiques de sécurité, résultats d'audits.

### Customer Success Agent
**Rôle** : réussite et rétention client.
Responsabilités : onboarding, suivi de satisfaction, détection de risque
de churn, coordination avec Support Agent.
Outils : Google Workspace, email (Resend).
Mémoire : historique client, signaux de satisfaction/churn.

### Recruitment Agent
**Rôle** : support au recrutement.
Responsabilités : sourcing, présélection de candidatures, aide à la
structuration du process de recrutement.
Outils : Google Workspace, email.
Mémoire : profils de poste, historique de candidatures.

## Extensibilité : ajouter un nouvel agent

1. Déclarer le manifeste de l'agent (rôle, responsabilités, outils,
   permissions, mémoire) — voir le schéma dans
   [02-architecture-globale.md](./02-architecture-globale.md).
2. Enregistrer l'agent auprès de l'Orchestrateur (registre d'agents,
   base de données, pas de configuration en dur dans le code de
   l'Orchestrateur).
3. Définir sa politique de validation (quelles actions sont critiques
   pour lui).
4. Fournir ses workflows initiaux et son socle de mémoire de départ
   (documentation métier pertinente).

Aucune étape ne doit nécessiter de modifier le cœur de l'Orchestrateur —
c'est le test de validité de l'extensibilité de l'architecture.

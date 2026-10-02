# 09 — Roadmap

Trois phases, dans cet ordre strict (voir priorités, 01). On ne démarre
pas une phase avant que la précédente soit validée sur des cas réels — la
généralisation prématurée est le risque principal identifié dans ce
projet.

## Phase 1 — Fondations de l'OS interne

Objectif : un Orchestrateur et un tout petit nombre d'agents qui exécutent
de vraies tâches pour Génération Capable, avec la sécurité et la mémoire
posées dès le départ (pas ajoutées après coup).

- Scaffold technique (`gc-ai-os`) : Orchestrateur minimal, schéma
  Supabase de base (`tasks`, `memory_entries`, `audit_log`,
  `role_permissions`).
- 2 à 3 premiers agents réels : **CTO Agent** (revue d'architecture),
  **DevOps Agent** (déploiement du site existant), **Supabase Agent**
  (migrations). Choisis parce qu'ils servent le développement de GC AI OS
  lui-même — le système commence à s'auto-entretenir tôt.
- Connecteurs GitHub et Supabase opérationnels (les deux nécessaires dès
  la phase 1).
- RBAC minimal + journal d'audit fonctionnel (pas de validation critique
  contournable, même en phase 1).
- Dashboard minimal : vue Tâches + vue Logs (le strict nécessaire pour
  observer ce que fait le système).

Critère de sortie de phase : au moins une tâche réelle de bout en bout
(ex. « ajouter une page au site », « corriger un bug ») exécutée par un
agent, validée par un humain, déployée, journalisée.

## Phase 2 — Élargissement de l'OS interne

Objectif : couvrir les fonctions non techniques de l'entreprise, avec
tous les 19 agents opérationnels sur des cas réels (pas seulement
déclarés).

- Agents restants activés progressivement, par ordre de valeur pour
  Génération Capable (proposition : QA, Marketing, Commercial, Support,
  Content avant Finance/Legal — ces deux derniers touchent à des actions
  critiques et méritent un RBAC déjà éprouvé par l'usage).
- Connecteurs additionnels : Stripe, Resend, Google Workspace,
  Slack/Discord, Notion, n8n/Make, Vercel/Netlify/Cloudflare/OVH.
- Mémoire métier peuplée avec la connaissance réelle de Génération
  Capable (vision, produits, vendeurs, ambassadeurs, scripts,
  formations — voir 04).
- Vues d'interface complètes (Agents, Mémoire, Workflows, Outils,
  Monitoring, Performances).
- Sandbox et rollback automatique éprouvés sur des incidents réels, pas
  seulement testés en isolation.

Critère de sortie de phase : GC AI OS gère une portion mesurable des
opérations quotidiennes de Génération Capable avec un taux
d'intervention humaine en baisse constante, suivi via la vue
Performances.

## Phase 3 — Généralisation vers GC AI Factory

Objectif : transformer l'architecture interne, déjà éprouvée, en
plateforme capable de créer et superviser des employés IA pour d'autres
organisations.

- Abstraction du concept d'« organisation » (aujourd'hui implicitement
  Génération Capable) comme entité de premier ordre dans le modèle de
  données — permissions, mémoire et agents scopés par organisation.
- Catalogue d'agents généralisé : les 19 agents deviennent des *modèles*
  d'agents personnalisables par secteur, plutôt que des instances fixes.
- Outillage de création d'agent en libre-service (ce que fait
  aujourd'hui un humain via le manifeste d'agent, voir 03, devient un
  parcours guidé).
- Isolation multi-tenant renforcée (la sécurité Zero Trust posée en
  phase 1 devient la base de l'isolation entre organisations clientes,
  pas une nouveauté de phase 3).
- Modèle de tarification et de facturation pour les organisations
  clientes (nouveau périmètre pour le Finance Agent).

Critère de sortie de phase : une deuxième organisation (pas Génération
Capable) utilise GC AI OS/Factory en production.

## Ce qui ne doit pas changer entre les phases

Les décisions d'architecture des documents 02, 04, 05, 06 (Orchestrateur
sans exécution directe, mémoire scopée et versionnée, connecteurs par
manifeste de capacités, Zero Trust/RBAC/audit) sont conçues pour tenir de
la phase 1 à la phase 3 sans réécriture. Si une phase ultérieure semble
nécessiter de les casser, c'est un signal pour réviser ce document
d'architecture explicitement — pas pour contourner discrètement une
règle posée en phase 1.

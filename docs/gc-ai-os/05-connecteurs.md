# 05 — Architecture de connecteurs

## Objectif

Permettre à n'importe quel agent d'utiliser GitHub, Supabase, Stripe,
Resend, Notion, Slack, Discord, Google Workspace (Drive, Calendar,
Gmail), OpenAI, Anthropic, OpenRouter, n8n, Make, Cloudflare, Vercel,
Netlify, OVH — et toute intégration future — **sans que l'ajout d'un
nouveau connecteur ne nécessite de modifier le cœur du système**.

## Pattern : adaptateur + manifeste de capacités

Chaque connecteur est un module indépendant qui expose :

```
Connector {
  id: "github" | "supabase" | "stripe" | ...
  capabilities: [
    { name: "create_pull_request", riskLevel: "low" },
    { name: "merge_pull_request", riskLevel: "medium" },
    { name: "deploy_edge_function", riskLevel: "high" },
    ...
  ]
  auth: OAuthConfig | ApiKeyConfig | ServiceAccountConfig
  execute(capability, params, context): Result
}
```

- `capabilities` déclare ce que le connecteur sait faire et le niveau de
  risque par défaut de chaque action (repris et affiné par le RBAC, voir
  06-securite.md).
- `execute` est le seul point d'entrée : aucun agent n'appelle une API
  tierce directement, il appelle toujours `execute(capability, params)`
  via la couche connecteur. Cela garantit que le journal d'audit et le
  contrôle de permissions sont **impossibles à contourner**, même par
  erreur de code dans un agent.
- Un connecteur ne connaît rien des agents : il ne fait qu'exposer des
  capacités et les exécuter. Le mapping « quel agent a le droit
  d'appeler quelle capacité » vit dans le RBAC, pas dans le connecteur.

## Ajouter un nouveau connecteur (procédure standard)

1. Implémenter l'interface `Connector` (auth + capacités + `execute`).
2. Déclarer ses capacités et leur niveau de risque par défaut.
3. Enregistrer le connecteur dans le registre de connecteurs (base de
   données ou fichier de configuration versionné — pas de branchement en
   dur dans l'Orchestrateur).
4. Attribuer les capacités aux agents concernés via le RBAC.
5. Écrire les tests d'intégration (avec mock du service tiers).

Aucune de ces étapes ne touche au code de l'Orchestrateur ni à celui des
autres connecteurs — c'est le critère de validation de l'extensibilité.

## Connecteurs prévus au lancement

| Connecteur | Usage principal | Agents principaux utilisateurs |
|---|---|---|
| GitHub | Code, PR, CI/CD, revue | CTO, Frontend, Backend, DevOps, QA |
| Supabase | Base de données, migrations, Edge Functions | Supabase, Backend, Data |
| Stripe | Facturation, paiements | Finance |
| Resend | Emails transactionnels et campagnes | Marketing, Support, Customer Success |
| Notion | Documentation collaborative | Content, CTO, CEO |
| Slack / Discord | Notifications, communication d'équipe | Support, Commercial, DevOps |
| Google Workspace (Drive, Calendar, Gmail) | Documents, planification, email | Content, Finance, Legal, Recruitment |
| OpenAI / Anthropic / OpenRouter | Modèles LLM sous-jacents des agents | Tous (via la couche modèle, pas un agent métier) |
| n8n / Make | Automatisations low-code externes | Automation Agent |
| Cloudflare / Vercel / Netlify / OVH | Hébergement, déploiement, DNS | DevOps |

## Modèles LLM comme cas particulier de connecteur

OpenAI, Anthropic et OpenRouter ne sont pas des connecteurs « métier »
comme les autres : ce sont les fournisseurs de la capacité de
raisonnement des agents eux-mêmes. Ils sont exposés via une **couche
modèle** distincte de la couche connecteurs métier, avec :

- Un identifiant de modèle par agent, remplaçable indépendamment
  (principe de modularité).
- Un routage possible par coût/latence/capacité (ex. un modèle plus
  petit pour un agent à faible charge cognitive comme le tri de tickets,
  un modèle plus capable pour l'architecture).
- Le même passage obligé par la couche d'audit que les autres
  connecteurs (chaque appel modèle est journalisé : coût, tokens, tâche
  associée) pour permettre le suivi de coût par agent et par tâche.

## Authentification et secrets

Voir [06-securite.md](./06-securite.md#gestion-des-secrets) pour le détail
— principe court : aucun secret de connecteur n'est stocké en clair dans
le code ou visible d'un agent ; les agents reçoivent un jeton d'exécution
scopé par la couche connecteur, jamais la clé API brute.

## Ce qui n'est pas retenu

- **Appels API directs depuis le code de chaque agent** — rejeté : rend
  l'audit et le contrôle de permission impossibles à garantir de façon
  centralisée, duplique la logique d'auth dans chaque agent.
- **Un connecteur générique « HTTP request »** sans manifeste de
  capacités — rejeté : impossible d'appliquer un RBAC ou un niveau de
  risque par action si le connecteur ne déclare pas ce qu'il fait.

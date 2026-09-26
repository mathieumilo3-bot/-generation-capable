# Audit de réutilisation

Inventaire des briques existantes (ce dépôt, les dépôts `-commercial-radar`, `jarvis`,
`resale-command-center`, `generationcapable`, `video-editor`, et les projets Supabase du compte),
confrontées aux besoins de PrixChantier.

Catégories : **1** réutilisable tel quel · **2** réutilisable avec adaptation · **3** utile comme
référence · **4** à ne pas réutiliser.

## Ce qui a été repris

| Existant | Où | Qualité | Cat. | Action dans PrixChantier |
| --- | --- | --- | --- | --- |
| Appel OpenAI en Structured Outputs strict (API Responses, modèle `gpt-5.6-luna`) | `supabase/functions/video-intelligence` | Fonctionne en production, mais JSON parsé sans validation, erreurs non typées | 2 | Même API et même modèle par défaut dans `src/lib/ai/llm.ts`, avec revalidation zod et pannes typées |
| Classification des pannes LLM (auth/crédit définitifs ; débit, délai, 5xx, réseau réessayables) | `video-editor/packages/model-router/src/llm.ts` | Très testé, mais classement par expressions régulières sur les messages | 2 | `classifyOpenAiError` s'appuie sur les erreurs typées du SDK ; la file de tâches ne réessaie plus une clé invalide ou un crédit épuisé, et attend plus longtemps en cas de saturation |
| Journal de coûts « télémétrie, jamais prérequis » | `video-editor/packages/cost-ledger` | Bon principe, lié à SQLite | 2 | Table `ai_usage` (tokens par entreprise / dossier / tâche), écrite en arrière-plan, sans jamais bloquer une analyse |
| `replyHead` : isoler la réponse du texte cité | `-commercial-radar/.../lib/outreach-brain.mts` | Simple, sain | 2 | `src/lib/mail/reply-text.ts`, complété pour Gmail FR sur deux lignes, Outlook, Apple Mail ; l'IA ne lit plus notre demande citée |
| Liste de suppression (bounce, plainte) | `-commercial-radar/.../lib/suppressions.mts` | Bon concept, stockage fragile (Blobs, lecture-écriture sans verrou) | 3 | Concept repris : un avis de non-remise passe la consultation en « Erreur » et annule les relances |
| Réessais sur incident passager des appels Supabase | `netlify/functions/_lib/supabase-admin.js` | Sain (écritures idempotentes dans ce projet) | 2 | `src/lib/supabase/resilient-fetch.ts` : réessais limités aux **lectures**, car nos écritures ne sont pas toutes idempotentes |
| Rate limiting en base (fenêtre fixe, partagé entre instances) | `supabase/migrations/0024_rate_limits.sql` | Sain | 3 | Déjà le même principe dans `rate_limit_hit` ; on garde le blocage en cas d'erreur (endpoints sensibles) plutôt que le laisser-passer du site vitrine |
| Validation UUID avant filtre | `netlify/functions/_lib/compliance/validate.js` | Sain | 3 | Déjà couvert par zod (`z.uuid()`) côté Server Actions |
| Planification pg_cron → pg_net | `resale-command-center/supabase/migrations/…every_15_minutes.sql` | Fonctionne mais secret en clair dans la migration | 3 | Même mécanisme, secret dans Vault (`configure_tick`) |

## Ce qui n'a pas été repris, et pourquoi

| Existant | Cat. | Raison |
| --- | --- | --- |
| Moteur d'envoi Resend + webhook entrant (`-commercial-radar`) | 4 | Envoie depuis un domaine d'entreprise, alors que PrixChantier doit envoyer depuis la vraie boîte Gmail / Microsoft 365 du chiffreur ; état stocké en tableaux JSON Netlify Blobs sans verrou |
| `netlify/functions/ai-proxy.js` | 4 | `json_object` sans schéma, erreurs renvoyées en HTTP 200 |
| `gc-ai-os` / `jarvis` (orchestrateur d'agents, RBAC d'agents, SQLite) | 4 | Hors sujet pour ce produit ; aucune intégration mail, document ou Excel |
| `gc-ai-os/packages/model-provider` | 4 | Texte libre uniquement, pas de sortie structurée |
| `video-editor/packages/uploads` (envoi reprenable sur disque) | 3 | Conçu pour des rushs vidéo de plusieurs Go ; nos documents (≤ 25 Mo) passent par des URL signées Supabase, plus simples et sans disque serveur |
| Relance après troncature avec contexte coupé (`video-editor` resilient-llm) | 4 | Couper le contexte ferait disparaître des lignes de devis en silence ; on signale « Document trop long » |
| Rate limit en mémoire (`site-vitrine/src/lib/rate-limit`) | 4 | Non partagé entre instances serveur |
| Projet Supabase générique « mathieumilo3-bot's Project » | 4 | Héberge déjà Jarvis et les tables vidéo ; y mettre des données clients B2B partagerait les comptes Auth avec des outils internes. PrixChantier doit avoir son propre projet |
| Composants UI du site vitrine | 3 | Composants maison hors shadcn/ui ; le cahier des charges impose shadcn/ui |

## Briques absentes de l'existant (construites pour PrixChantier)

Aucune implémentation n'existait pour : Gmail OAuth / Microsoft Graph, lecture et suivi de fils
e-mail, pièces jointes entrantes, extraction PDF / Excel / CSV, OCR, génération Excel, exports XLSX,
file de tâches avec verrouillage (`for update skip locked`). Elles ont été écrites pour ce produit
(voir `src/lib/mail`, `src/lib/parsing`, `src/lib/export`, `src/lib/jobs`).

## Point de vigilance hors PrixChantier

`resale-command-center/supabase/migrations/20260827_run_supplier_engine_every_15_minutes.sql`
écrit la clé d'appel du cron en clair (`<ref du projet>-cron`), donc devinable par quiconque connaît
l'URL du projet. À remplacer par un secret stocké dans Vault.

# GC Preview Engine V2 — architecture

> Statut : **développement isolé**. Aucune page publique ne pointe vers la V2.
> `/audit` (le tunnel qui reçoit la publicité) n'est pas modifié.

## 1. État de l'architecture actuelle (V1, `main`)

Le tunnel V1 est piloté **par le navigateur**, parce que l'hébergement coupe
chaque requête synchrone à 10 s. Toute étape longue devient un job OpenAI en
mode *background*, que le navigateur interroge.

| Étape | Code | Rôle | Durée |
|---|---|---|---|
| Préfiltre registre | `lib/audit-engine/company-registry.ts` | recherche-entreprises.api.gouv.fr : unique / homonymes / aucun, SIREN, ville, CP | ≤ 1,8 s |
| Identification | `lib/audit-engine/company-discovery.ts` + `POST /api/audit/discover` | job web-search (modèle rapide), passe « rescue » (modèle premium), vérification déterministe du domaine (`verifyOfficialSite`) | 10–30 s |
| Lecture du site | `lib/audit-engine/crawl.ts` via `probe.ts` | ≤ 12 pages, sitemap, liens, formulaires, CTA, preuves, labels — protections SSRF sur chaque requête | ≤ 5 s |
| Faits + cartes site | `lib/audit-engine/facts.ts` | services, pages dédiées, zone, téléphone, formulaires, preuves, labels ; cartes déterministes | instantané |
| Enquête | `lib/audit-engine/diagnostic.ts` + `/api/audit/research` + `/api/audit/analyze` | job web-search premium : recherche + 3 leviers ; validation anti-invention (chiffres, citations, spécificité) | 60–120 s |
| Persistance | `lib/audit-leads.ts` → RPC Supabase `gc_*_audit_*` (projet `generation-capable-ambassadeurs`) | table `gc_audit_leads`, RLS, RPC `SECURITY DEFINER` gardées par un secret | — |
| Reprise | `netlify/functions/audit-ready-cron.mjs` (chaque minute) + `/audit/reprendre` | le cron poll le job d'un lead qui a laissé son email, envoie l'email Resend, le lien rouvre `/audit/merci` | — |
| Conversion | `lib/booking.ts` `buildCalendlyUrl()` | Calendly + UTM | — |
| Mesure | `lib/tracking.ts` (dataLayer), `ConsentBanner.tsx` (`gc-revenue-consent-v1`) | l'attribution n'est transmise que si la mesure est acceptée | — |

Limites de la V1 pour une *preview* :
- le crawl ne conserve ni images, ni logo, ni couleurs ;
- le résultat de la recherche web (avis, profils, services hors site) est jeté
  après la génération des cartes ;
- la suite de l'analyse n'avance côté serveur **que** si un email est laissé ;
  sinon elle dépend de l'onglet ouvert.

## 2. Ce que la V2 réutilise tel quel

- `lookupFrenchRegistry` / `classifyRegistryResults` (enrichis de champs optionnels : adresse, NAF, enseigne, date de création — sans changer le comportement V1) ;
- `startCompanyDiscovery` / `collectCompanyDiscovery` / `verifyOfficialSite` ;
- `crawlSite` (nouveau hook optionnel `onPage` pour récupérer le HTML déjà téléchargé — aucune requête supplémentaire) ;
- `buildDossier`, `startInvestigation`, `toAuditContext`, `siteOnlyDiagnostic`, validation des cartes (`validateCard`) ;
- `collectInvestigation` : nouvelle variante `collectInvestigationDetailed` qui renvoie aussi les notes de recherche (la V1 continue d'appeler l'ancienne) ;
- `resolveTargetUrl`, `resolvesToBlockedIp`, `resolveSafeRedirect` pour toute nouvelle requête sortante (images) ;
- `startBackgroundResponse` / `pollBackgroundResponse` ;
- `registerAuditLead` (le lead reste visible dans le flux actuel) ;
- `buildCalendlyUrl`, `track`, le consentement existant, le cron, `/audit/reprendre`.

## 3. Ce que la V2 ajoute

```
IDENTITY → DISCOVERY → CRAWL → RESEARCH → TRUTH_BUNDLE → BLUEPRINT → VALIDATE → RENDER → STORE → NOTIFY
```

- `lib/preview-engine/` — le moteur :
  - `pipeline.ts` : machine à états persistée. Chaque appel `advance()` exécute
    des étapes tant qu'il reste du budget (< 7 s) ; une étape qui attend un job
    externe rend la main. Le navigateur **ou** le cron peuvent faire avancer
    une preview ; un bail (`lease`) en base empêche deux avancements simultanés.
  - `assets.ts`, `colors.ts` : images publiées, logo, couleurs observées (pur, sans réseau).
  - `trades.ts` : 12 familles métier + règles (ordre des sections, preuve prioritaire, héros).
  - `profile.ts` : le **VerifiedCompanyProfile** (chaque fait = `value` + `source` + `confidence`).
  - `blueprint-schema.ts` : schéma Zod strict du **PreviewBlueprint** (liste blanche de sections et variantes).
  - `blueprint-base.ts` : blueprint déterministe (le plancher, toujours disponible).
  - `blueprint-ai.ts` : job premium qui ne produit **que** du JSON (ordre, copy, choix d'actifs).
  - `claims.ts` + `blueprint-validate.ts` : garde anti-invention champ par champ ; tout champ refusé retombe sur le plancher.
  - `store.ts` : RPC Supabase `gc_preview_*` (mémoire en dev/test uniquement).
  - `tokens.ts` : jeton de lecture HMAC par preview, URLs d'images signées.
- `components/preview/` — le renderer déterministe (≈ 12 sections, 2–3 variantes chacune).
- `/audit/preview-v2` — le tunnel V2 (1 champ) ; `/audit/preview-v2/vitrine` — la preview.
- `/api/preview/{start,advance,clarify,notify,result,image,worker}`.

## 4. Schéma de données

Table `public.gc_site_previews` (migration `supabase/migrations/0026_gc_site_previews.sql`) :

| colonne | type | rôle |
|---|---|---|
| `id` | uuid | identifiant (aléatoire) |
| `preview_token_hash` | text | sha256 du jeton de lecture (le jeton lui-même = HMAC serveur de l'id, jamais stocké) |
| `idempotency_key` | text unique | double-clic / réessai = même preview |
| `lead_id` | uuid null | lien vers `gc_audit_leads` quand un email est laissé |
| `company_name`, `siren`, `official_domain` | text | identité résolue |
| `fingerprint` | text | sha256(SIREN ‖ domaine ‖ nom+ville) + version données |
| `status` | text | `running` · `needs_input` · `ready` · `failed` |
| `stage` | text | étape courante |
| `pipeline` | jsonb | par étape : `status, startedAt, completedAt, errorCode, retryCount, engineVersion` |
| `work` | jsonb | données intermédiaires (jobs, dossier, actifs) — jamais servies au client |
| `company_profile` | jsonb | VerifiedCompanyProfile |
| `audit_report` | jsonb | rapport V1 (compatible `AuditReport`) |
| `preview_blueprint` | jsonb | PreviewBlueprint validé |
| `input`, `attribution` | jsonb | saisie + UTM/gclid (seulement si mesure acceptée) |
| `email`, `notified_at` | | email transactionnel « prévenez-moi » |
| `lease_id`, `lease_until` | | verrou d'avancement |
| `engine_version`, `error_code` | text | |
| `created_at`, `updated_at`, `ready_at`, `expires_at` | timestamptz | |

RLS activée, **aucune policy**, privilèges table retirés à `anon`/`authenticated` :
tout passe par des RPC `SECURITY DEFINER` gardées par `gc_audit_secret_ok`.
Aucune RPC ne liste les previews pour un client ; la lecture publique exige
`id` (UUID v4) + jeton HMAC vérifié côté serveur.

## 5. Cache et coûts

- empreinte données = SIREN (sinon domaine, sinon nom+ville) + `PREVIEW_DATA_VERSION` ;
- preview prête < 7 jours pour la même empreinte → copiée, aucune recherche relancée ;
- données identiques mais version du blueprint différente → seules les étapes BLUEPRINT → STORE sont rejouées ;
- job en cours pour la même empreinte → la nouvelle demande le **suit** au lieu d'en relancer un ;
- clé d'idempotence par soumission, bouton désactivé après clic.

## 6. Risques identifiés

| Risque | Mitigation |
|---|---|
| Casser le tunnel publicitaire | aucune modification de `/audit`, `/api/audit/*` ne change de comportement ; flag `GC_PREVIEW_V2` (`off` · `internal` · `on`) |
| Limite 10 s par requête | chaque requête fait au plus une étape longue ; les jobs OpenAI tournent en background |
| Hallucination (avis, labels, années, 24/7, gratuit…) | le modèle ne choisit que des identifiants de faits ; toute phrase est contrôlée par `claims.ts` contre le profil ; plancher déterministe |
| Faux « chantier réalisé » | une image n'est présentée comme réalisation que si elle vient d'une page réalisations du site officiel ; sinon « photo publiée sur votre site » |
| Images tierces (hotlink, http, vie privée, SSRF) | proxy `/api/preview/image` signé HMAC, protections SSRF de `probe.ts`, types image uniquement, 5 Mo max, SVG sandboxé |
| Prompt injection via le site | le contenu du site n'entre dans le prompt que comme données JSON bornées, jamais comme instructions ; la sortie est un JSON validé |
| Pages indexées de fausses entreprises | `noindex, nofollow` (meta + en-tête `X-Robots-Tag`), pas de lien public, jeton requis |
| Double facturation | idempotence, déduplication par empreinte, bail d'avancement |
| Réseau du bac à sable fermé | la batterie réelle (34 entreprises) tourne dans GitHub Actions contre un déploiement de branche |

## 7. Quality gate (bascule interdite tant que non vert)

build · lint · unitaires · E2E · 34 previews réelles · mobile · email · reprise · CTA — voir `docs/preview-engine-v2-quality-gate.md`.

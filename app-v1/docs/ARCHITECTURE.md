# Architecture

```
┌────────────── APPLICATION (iOS · Android · Web : Expo / React Native) ──────────────┐   ┌─ BACK-OFFICE (web, Vite) ─┐
│ Auth Supabase · Wallet · Créer · Projets · Résultat · Compte                         │   │ staff uniquement          │
└───────────────┬──────────────────────────────────────────────────────────────────────┘   └────────────┬──────────────┘
                │ clé publishable + JWT utilisateur                                                      │ RPC admin_*
                ▼                                                                                        ▼
┌───────────────────────────────────────────── SUPABASE ──────────────────────────────────────────────────────────────────┐
│ Postgres (RLS partout) : ledger, wallet_holds, pricing_rules, video_jobs, versions…  RPC atomiques & idempotentes        │
│ Storage privé (raw/processed/renders/thumbnails/temporary, URLs signées)   Realtime   Auth (Apple · Google · OTP e-mail)  │
│ Edge Functions : stripe-webhook · create-topup-checkout · create-card-setup · auto-reload-run · verify-store-purchase ·   │
│                  delete-account · apple-link · send-invitation-email                                                      │
└───────────────▲───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                │ clé secrète (serveur) : RPC svc_*  — claim par bail, progression, capture/release, coûts
┌───────────────┴─────────────── ORCHESTRATEUR (Node, services/orchestrator) ───────────────────────────────────────────────┐
│ réclame les jobs · signe les URLs d'entrée · suit le moteur · livre le rendu dans le Storage · coûts · push · e-mails    │
└───────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                │ HTTP serveur-à-serveur, jeton ENGINE_GATEWAY_TOKEN
                ▼
┌──────────── PASSERELLE /api/engine/v1 (video-editor/apps/web) ────────────┐
│ intake sécurisé (allowlist d'hôtes) · idempotence par externalJobId       │
└──────────────┬────────────────────────────────────────────────────────────┘
               ▼
        MOTEUR VIDÉO EXISTANT (video-editor/ : pipeline, queue SQLite, FFmpeg, Remotion) — NON reconstruit
```

L'application mobile **ne parle jamais** à l'orchestrateur ni au moteur. Le moteur n'a aucune connaissance des utilisateurs, des prix ou des soldes.

## Décisions structurantes

| Sujet | Décision | Pourquoi |
|---|---|---|
| Source de vérité métier | Postgres (jobs, wallet, versions) ; la queue SQLite du moteur n'est qu'un détail d'exécution | Atomicité financière, RLS, audit |
| Argent | `bigint` de **centimes**, ledger append-only (`wallet_transactions`), `wallets.balance/held` écrits **uniquement** par `private.wallet_apply` | Aucun float, aucune modification silencieuse |
| Facturation d'un job | `submit_video_job` : prix serveur → solde → job → **HOLD** atomique. Succès → **CAPTURE**. Échec définitif / annulation → **RELEASE** | Le client ne paie jamais un rendu inexistant |
| Idempotence | clé par intention (`video_jobs(user_id, idempotency_key)`), un job actif par projet, `wallet_transactions(wallet_id, idempotency_key)`, `webhook_events(provider, event_id)`, `payments(provider, provider_ref)`, tentative auto-reload par heure, soumission moteur par `externalJobId` | Double clic / webhook ×4 / retry worker = un seul effet |
| Concurrence | verrous toujours pris dans l'ordre job → projet → wallet ; claim `FOR UPDATE SKIP LOCKED` avec bail | Pas de deadlock, pas de double traitement |
| Sécurité des données | RLS sur chaque table ; `GRANT` en liste blanche (révocation globale puis octroi explicite) ; fonctions `SECURITY DEFINER` avec `search_path=''` ; schéma `private` non exposé | Cloisonnement A/B testé |
| Capacités moteur | `engine_capabilities` synchronisée depuis la passerelle ; l'app **et** le serveur refusent toute option non supportée | « Ne jamais montrer une fonction non supportée » |
| Méthodes de montage | table `editing_methods` (données) → `engine_config` jamais exposé au client | Ajouter Podcast/UGC/VSL sans republier |
| Paiements | `PaymentProvider` (Stripe / Apple / Google) ; le crédit n'a lieu qu'**après confirmation serveur vérifiée** ; matrice par plateforme en configuration | Règles des stores évolutives (docs/STORE_PAYMENT_POLICY.md) |
| Observabilité | `correlation_id` par job, `job_events`, `webhook_events`, `audit_logs` immuables, logs JSON structurés | Retrouver un incident client rapidement |

## Cycle de vie d'un job

`created → queued → preparing → analyzing → editing → rendering → quality_check → completed | failed | cancelled`
Mappé côté client en 5 étapes humaines (Préparation · Analyse · Création du montage · Finalisation · Contrôle qualité). Échec temporaire → `queued` avec backoff (le HOLD est conservé) ; échec définitif → RELEASE + notification « Aucun montant n'a été prélevé ». Orchestrateur tué → bail expiré → `svc_requeue_stale_jobs` → reprise (soumission moteur idempotente).

## Organisation du dépôt

```
app-v1/
  apps/client      Expo Router (iOS/Android/Web)         apps/admin   Vite (back-office)
  packages/        config · domain (logique pure) · api (Supabase + upload TUS) · payments · video-engine · analytics · ui
  services/orchestrator   pont Postgres ⇄ moteur
  supabase/        migrations · functions (Edge) · tests SQL · templates · config.toml
  web-public/      pages légales, liens universels
video-editor/      moteur existant + passerelle /api/engine/v1
```

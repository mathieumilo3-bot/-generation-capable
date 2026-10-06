# SETUP_REQUIRED — ce qu'il faut renseigner avant la mise en production

Rien de ce qui suit n'est fourni par le dépôt : ce sont vos identifiants et décisions. **Aucun paiement ni aucune authentification n'est simulé en production** : tant qu'une clé manque, la fonctionnalité correspondante est désactivée ou échoue proprement.

> Trois environnements = **trois projets Supabase distincts** (`development`, `staging`, `production`) et trois jeux de variables. Ne réutilisez **pas** le projet Supabase de « Génération Capable » (`fkhfahmzxsahrstxntjs`) : ses tables (`profiles`, `payments`, `wallets`, `notifications`…) entrent en collision avec ce schéma et contiennent des données d'un autre produit.

## 0. Ordre conseillé

1. Projet Supabase (§1) → migrations → utilisateur admin.
2. Moteur + passerelle déployés (§6) → orchestrateur (§7).
3. Stripe (§2) → web fonctionnel de bout en bout.
4. Apple (§3) / Google (§4) → builds stores.
5. E-mails (§5), domaine & liens universels (§8), EAS (§9).
6. Décisions business (§10) **avant** toute soumission aux stores.

---

## 1. Supabase

| Élément | Où le récupérer | Où le mettre | Pourquoi |
|---|---|---|---|
| `SUPABASE_URL` | Dashboard → Project Settings → API | `EXPO_PUBLIC_SUPABASE_URL` (client), `VITE_SUPABASE_URL` (admin), `SUPABASE_URL` (orchestrateur) | Point d'entrée API |
| Clé **publishable** (`sb_publishable_…`) | Settings → API Keys | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SB_PUBLISHABLE_KEY` (functions) | Clé publique : l'accès aux données est protégé par la RLS |
| Clé **secret** (`sb_secret_…`) | Settings → API Keys | `SB_SECRET_KEY` (orchestrateur) et `supabase secrets set` (functions) — **jamais** dans une app ni un navigateur | Appels serveur (RPC `svc_*`, Storage, Auth admin) |

**Appliquer le schéma** (depuis `app-v1/`) :

```bash
npm i -g supabase            # ou npx supabase
supabase link --project-ref YOUR_PROJECT_REF
supabase db push             # applique supabase/migrations/*.sql (schéma, RLS, RPC, buckets privés, config initiale)
```

**Premier administrateur** : créez l'utilisateur (Dashboard → Authentication → Users → *Add user*, e-mail confirmé), puis dans le SQL Editor :

```sql
insert into public.staff_roles (user_id, role) values ('<uuid de l'utilisateur>', 'admin');   -- ou 'support' (lecture seule)
```

**Authentication → URL Configuration** : *Site URL* = domaine web de l'app ; *Redirect URLs* = `montage://auth/callback`, `https://app.example.com/auth/callback`, `http://localhost:8081/auth/callback` (adapter schéma/domaines à vos valeurs `APP_SCHEME` / `APP_LINK_DOMAIN`).

**Authentication → Email** : activer *Email OTP* ; coller `supabase/templates/otp.html` dans les modèles *Magic Link* et *Confirm signup* (il affiche `{{ .Token }}`, le code à 6 chiffres) ; configurer un **SMTP personnalisé** (Resend SMTP) : le SMTP par défaut de Supabase est limité en débit et réservé aux tests. Réglez *Rate limits* (e-mails/heure) et envisagez un CAPTCHA.

**Authentication → Providers** : Apple (§3) et Google (§4).

**Storage** : les buckets `raw`, `processed`, `renders`, `thumbnails`, `temporary` sont créés **privés** par les migrations. Réglez la limite de taille globale (Settings → Storage) à **≥ 2 Gio** — cela exige un plan payant. Utilisez l'hôte direct `*.storage.supabase.co` pour les gros envois si vous le souhaitez (`storageUrl` de `supabaseTusTransport`).

**Edge Functions** :

```bash
cp supabase/functions/.env.example supabase/functions/.env   # remplir
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy stripe-webhook create-topup-checkout create-card-setup auto-reload-run delete-account apple-link verify-store-purchase send-invitation-email
```

`config.toml` désactive `verify_jwt` (les nouvelles clés ne sont pas des JWT) : chaque fonction vérifie elle-même l'utilisateur, le secret cron ou la signature Stripe.

## 2. Stripe (web)

| Variable | Où | Où la mettre | Pourquoi |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Dashboard → Developers → API keys | secrets des functions | Créer sessions Checkout, recharges automatiques |
| `STRIPE_WEBHOOK_SECRET` | Developers → Webhooks → *Add endpoint* | secrets des functions | **Seule voie de crédit du wallet** |

- URL du webhook : `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`.
- Événements à cocher : `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_failed`.
- Moyens de paiement : Settings → Payment methods — activez ceux de votre choix (carte, Apple Pay, Google Pay, Link…). Checkout les propose automatiquement selon l'utilisateur ; **pour Apple Pay sur le web, vérifiez votre domaine** dans Stripe.
- Reçus : Settings → Emails → *Successful payments*. Fiscalité / Stripe Tax : **à valider avec votre comptable** (voir §10) — le code n'applique aucune règle fiscale.
- Tests : cartes de test Stripe en mode test ; `stripe listen --forward-to` pour le local.

## 3. Apple

| Variable | Où la récupérer | Où la mettre | Pourquoi |
|---|---|---|---|
| Compte Apple Developer, App ID `APP_BUNDLE_ID` avec *Sign in with Apple*, *Associated Domains*, *In-App Purchase* | developer.apple.com → Identifiers | `APP_BUNDLE_ID` (EAS) | Identité de l'app |
| Services ID (connexion web/Android) | Identifiers → Services IDs | Supabase → Auth → Apple (`APPLE_CLIENT_IDS` : bundle id + services id) | OAuth Apple hors iOS |
| Clé *Sign in with Apple* (.p8), `APPLE_KEY_ID`, `APPLE_TEAM_ID`, `APPLE_CLIENT_ID` | Keys → + → Sign in with Apple | secrets des functions (`APPLE_PRIVATE_KEY` en une ligne avec `\n`) ; secret OAuth Supabase (`APPLE_OAUTH_SECRET`, JWT à régénérer < 6 mois) | **Révoquer le jeton Apple à la suppression du compte (obligatoire)** |
| `APPLE_TOKEN_ENC_KEY` | `openssl rand -base64 32` | secrets des functions | Chiffre le refresh token Apple stocké |
| Clé *App Store Server API* : `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_PRIVATE_KEY` | App Store Connect → Users and Access → Integrations → In-App Purchase | secrets des functions | Vérifier les achats côté serveur |
| 4 produits **consommables** `wallet_topup_10/20/50/100` | App Store Connect → In-App Purchases | `payments.store_packs` (table `app_settings`) | Recharge iOS par packs fixes |
| `TEAMID` dans `apple-app-site-association` | Membership | `web-public/.well-known/` | Universal Links |

> Le client doit transmettre `appAccountToken = <uuid de l'utilisateur>` à l'achat : le serveur refuse tout reçu non lié à l'utilisateur.

## 4. Google

| Variable | Où | Où la mettre | Pourquoi |
|---|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_SECRET` | Google Cloud → APIs & Services → Credentials (client « Web ») | Supabase → Auth → Google | Connexion Google (OAuth navigateur) |
| `APP_ANDROID_PACKAGE`, certificat de signature Play | Play Console → App integrity | EAS ; `assetlinks.json` (SHA-256) | App Links |
| Produits intégrés consommables `wallet_topup_10/20/50/100` | Play Console → Monetize → In-app products | `payments.store_packs` | Recharge Android par packs fixes |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PACKAGE_NAME` | Google Cloud (compte de service) + Play Console → API access (droit *Financial data / orders*) | secrets des functions | Vérifier/acquitter les achats |
| URL de suppression de compte | `web-public/supprimer-mon-compte.html` hébergée | Play Console → App content → Data safety / Account deletion ; `app_settings.urls.account_deletion` | Obligatoire Google Play |

## 5. E-mails transactionnels (Resend)

`RESEND_API_KEY`, domaine d'envoi vérifié (DNS SPF/DKIM) → secrets des functions + `.env` de l'orchestrateur ; `EMAIL_FROM` ; le même service (SMTP) peut envoyer les codes de connexion Supabase (§1). Sans clé, les e-mails sont désactivés (journalisé), les notifications in-app/push continuent.

## 6. Moteur vidéo (`video-editor/`) et passerelle

À déployer sur une machine durable (voir `video-editor/README.md`, Fly.io). Variables **côté moteur** :

| Variable | Valeur | Pourquoi |
|---|---|---|
| `ENGINE_GATEWAY_TOKEN` | ≥ 32 caractères aléatoires | Jeton serveur-à-serveur ; **sans lui la passerelle `/api/engine/v1` est fermée** |
| `ENGINE_ALLOWED_INPUT_HOSTS` | `YOUR_PROJECT_REF.supabase.co` | Anti-SSRF : seuls ces hôtes (HTTPS) peuvent être téléchargés |
| `VIDEO_EDITOR_STORAGE_ROOT` | volume persistant (`/data`) | Fichiers + base SQLite du moteur |
| `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `GOOGLE_API_KEY` | consoles respectives | **Qualité de montage** : sans elles le moteur tourne en mode déterministe honnête (pas de sous-titres parlés, sélection éditoriale simplifiée) |
| `ENGINE_DURATION_TARGET_RATIO` (0,9), `ENGINE_MAX_INPUT_BYTES` | optionnels | Cible de durée dans le palier payé, taille max par fichier |

Ne **jamais** exposer l'UI historique du moteur (cookie utilisateur non authentifié) sur Internet : placez le moteur sur un réseau privé ou derrière un pare-feu n'autorisant que l'orchestrateur.

## 7. Orchestrateur

Voir `services/orchestrator/.env.example`. `ENGINE_URL` + `ENGINE_TOKEN` (= `ENGINE_GATEWAY_TOKEN`), `SB_SECRET_KEY`, `CRON_SECRET` (identique à celui des functions : déclenche la recharge automatique). Lancer : `npm run start -w @app/orchestrator` (Docker : `services/orchestrator/Dockerfile`). Une ou plusieurs instances : le claim par bail est atomique.

## 8. Domaine, liens universels, hébergement web

- Domaine de l'app (ex. `app.example.com`) : `APP_LINK_DOMAIN`, `APP_WEB_URL` ; héberger `apps/client/dist` (export web) + `web-public/` (pages légales, `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json`) ; admin sur un sous-domaine séparé et restreint (`admin.example.com`).
- Renseigner `app_settings` : `urls.terms`, `urls.privacy`, `urls.support`, `urls.account_deletion`, `urls.manage_data`, `product.name`, `product.support_email` (via le back-office → Réglages).

## 9. Expo / EAS

`npm i -g eas-cli && eas login && cd apps/client && eas init` → `EAS_PROJECT_ID`. Variables par environnement : `eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL …` (idem publishable key, `APP_*`). Identifiants iOS/Android : `eas credentials`. Builds : `eas build -p ios|android --profile development|staging|production`. Soumission : renseigner `submit.production.ios.ascAppId` dans `eas.json`. Les icônes/splash de `assets/` sont des **placeholders** à remplacer.

## 10. Décisions business à valider (valeurs provisoires, toutes modifiables sans republier)

| Sujet | Valeur actuelle | Où la changer |
|---|---|---|
| Prix d'une modification | **1,21 €** (placeholder) | Back-office → Tarifs (`pricing_rules`, mode `revision`) |
| Durée de conservation rushs / rendus | **illimitée** (`null`) | `app_settings.retention.*_days` (aucune purge automatique tant qu'elle n'est pas décidée) |
| Création autonome (« Créez tout pour moi ») | **masquée** : le moteur n'a pas de génération vidéo (`autonomous_creation=false`) | s'active toute seule quand la passerelle publie la capacité ; prix 2,90 € / 5,80 € déjà en base |
| Recharge iOS/Android | packs fixes 10/20/50/100 €, **sans** auto-recharge ni montant libre | `payments.providers`, `payments.store_packs` ; **voir `docs/STORE_PAYMENT_POLICY.md` : à valider avec App Review** |
| Statut juridique du solde prépayé, TVA, droit de rétractation | non tranché | **juriste + comptable** avant ouverture au public |
| Textes légaux | modèles factuels dans `web-public/` | **juriste** |
| Nom de marque, logo, icônes | « Montage », placeholders | `app_settings.product.name`, `assets/`, `APP_NAME` |

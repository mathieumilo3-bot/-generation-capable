# PrixChantier

Consultations fournisseurs pour les entreprises du BTP (CVC, plomberie, électricité, TCE).

> Importer son dossier → sélectionner ses fournisseurs → envoyer les consultations → laisser le
> système suivre les réponses → récupérer un comparatif exploitable.

Les fournisseurs n'ont **rien** à faire de nouveau : ils reçoivent un e-mail depuis la vraie boîte
du chiffreur et répondent comme d'habitude (fichier Excel joint complété, leur propre devis PDF / Excel,
ou simple e-mail).

## Architecture

Un monolithe Next.js 16 + Supabase. Pas de microservice.

| Brique | Rôle |
| --- | --- |
| `src/app` | Pages (App Router) et routes API (`/api/cron/tick`, OAuth mail, export, téléchargements) |
| `src/actions` | Server Actions : toutes les mutations, validées par zod, exécutées sous la session de l'utilisateur (RLS) |
| `src/lib/parsing` | Lecture déterministe XLSX / XLS / CSV / PDF (texte). Le DPGF tabulaire est lu **sans IA** |
| `src/lib/ai` | OpenAI (API Responses, `gpt-5.6-luna` par défaut) en Structured Outputs (JSON Schema strict, revalidé par zod) : classement des lignes, DPGF PDF, offres fournisseurs. Pannes typées, journal de consommation `ai_usage` |
| `src/lib/matching` | Rapprochement ligne d'offre ↔ ligne demandée (référence, similarité, quantité, avis IA) — jamais forcé |
| `src/lib/comparison` | Comparatif, détection des trous, phrases d'analyse (fonction pure, testée) |
| `src/lib/mail` | Gmail API et Microsoft Graph (OAuth PKCE, tokens chiffrés AES-256-GCM), relève des réponses |
| `src/lib/jobs` + `src/lib/workflows` | File de tâches Postgres (analyse, relève, traitement des réponses, relances) |
| `supabase/migrations` | Schéma, RLS, stockage, Supabase Cron |

### Principes de fiabilité

- **Aucune donnée source n'est modifiée silencieusement** : chaque ligne garde sa valeur d'origine
  (`original`) et sa position (fichier, onglet, ligne Excel ou page PDF). Les corrections de
  l'utilisateur sont marquées « Modifiée ».
- **L'IA ne décide rien** : elle extrait dans un schéma strict. Une valeur incertaine (confiance
  < 0,6) n'est pas promue : l'interface affiche « À vérifier ». Une correspondance incertaine reste
  « Correspondance à vérifier ».
- **Le fichier Excel de consultation** porte les identifiants des lignes (colonne et feuille
  masquées) : s'il revient complété, la lecture est exacte, sans IA.
- **OCR uniquement si nécessaire** : un PDF n'est envoyé en lecture visuelle que s'il contient moins
  de 80 caractères de texte par page.
- **Le comparatif n'annonce jamais « le meilleur fournisseur »** quand les périmètres diffèrent :
  « B est actuellement 930 € moins cher que A, mais 3 lignes sont absentes et la mise en service
  semble exclue », puis la meilleure offre complète et une comparaison à périmètre identique.
- **Actions interdites à l'IA** : aucune acceptation, commande, signature ni négociation. Le premier
  e-mail d'une consultation ne part qu'après un clic de l'utilisateur ; seules les relances suivent
  une règle qu'il a activée (48 h puis 72 h, jamais deux messages le même jour, jamais après une
  réponse, un refus, une erreur ou une annulation).

### Rattachement des réponses

Dans l'ordre : identifiant de fil (Gmail `threadId` / Graph `conversationId`) → en-têtes
`In-Reply-To` / `References` → référence `PC-XXXXXX` dans l'objet → expéditeur connu **uniquement
s'il n'a qu'une consultation en cours** (sinon la réponse va dans « Réponses à rattacher »).
Les messages sans rapport avec une consultation ne sont jamais stockés. Les réponses automatiques
(absence) ne stoppent pas les relances.

Les briques reprises d'autres projets du compte (et celles écartées) sont listées dans
[`docs/REUTILISATION.md`](docs/REUTILISATION.md).

## Démarrage local

Prérequis : Node 22, Docker.

```bash
npm ci
npx supabase start          # Postgres, Auth, Storage, Mailpit en local
cp .env.example .env.local  # puis renseigner les clés affichées par `supabase status`
openssl rand -base64 32     # → TOKEN_ENCRYPTION_KEY
openssl rand -hex 24        # → CRON_SECRET
npm run dev
```

Sans identifiants Google/Microsoft, activez `ENABLE_TEST_MAILBOX=1` (développement uniquement) :
une « boîte de test » écrit les e-mails envoyés sur disque (`$TMPDIR/prixchantier-mailbox`).
Elle est refusée au démarrage en production.

Pour déclencher le traitement de fond en local : `curl -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/tick`.

## Tests

```bash
npm run lint && npm run typecheck
npm test                     # unitaires : parsing DPGF (XLSX, multi-onglets, fusions, XLS, CSV), PDF, rapprochement, comparatif, fichier de consultation
npm run test:integration     # contre Supabase local : isolation RLS (23 tests) + parcours serveur complet
npm run build && npm run test:e2e   # Playwright : scénario d'acceptance complet dans le navigateur
```

Fixtures anonymisées dans `tests/fixtures/files` (régénérables : `npm run fixtures`) : DPGF standard,
multi-onglets, cellules fusionnées, XLS, CSV Windows-1252, devis PDF, devis Excel fournisseur, devis
sans références identiques, devis avec variante, devis incomplet, PDF scanné.

Dans les tests d'intégration et e2e, **deux éléments externes sont simulés** : la messagerie
(boîte de test sur disque) et l'API OpenAI (double déterministe ; en e2e, un faux serveur HTTP
appelé via `OPENAI_BASE_URL`, aucun code de test dans l'application). Tout le reste est réel.

## Déploiement

1. **Supabase** (région UE) : `npx supabase link` puis `npx supabase db push`.
   - Auth → URL Configuration : `Site URL` = `APP_URL`, redirect `APP_URL/**`.
   - Auth → Email : confirmation activée, SMTP personnalisé (Resend, Brevo…).
   - Le bucket privé `files` et ses policies sont créés par les migrations.
2. **Application** (Vercel ou tout hébergeur Node) : variables de `.env.example`. Les routes longues
   (`/api/cron/tick`) déclarent `maxDuration = 300`.
3. **Supabase Cron** (une fois, éditeur SQL) :
   ```sql
   select public.configure_tick('https://app.exemple.fr/api/cron/tick', '<CRON_SECRET>');
   ```
   Le secret est stocké dans Vault ; `/api/cron/tick` refuse tout appel sans ce secret.

### Gmail (Google Cloud)

1. Activer **Gmail API**, écran de consentement « External ».
2. Identifiant OAuth « Application Web », redirect : `APP_URL/api/mail/google/callback`.
3. Scopes : `gmail.send`, `gmail.readonly`, `openid`, `email`.
   ⚠️ `gmail.readonly` est un scope **restreint** : au-delà de 100 utilisateurs de test, Google exige
   une vérification de l'application et un audit de sécurité (CASA). À lancer dès les premiers clients.

### Microsoft 365 (Entra ID)

1. App registration multi-tenant, redirect Web : `APP_URL/api/mail/microsoft/callback`.
2. Permissions déléguées Microsoft Graph : `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access`.
3. Créer un secret client → `MICROSOFT_CLIENT_SECRET`. Certains tenants exigent le consentement
   d'un administrateur.

## Sécurité

- RLS sur toutes les tables, clés étrangères composites `(id, organization_id)` : une ligne ne peut
  pas référencer la donnée d'une autre entreprise, même en cas d'erreur de policy.
- Jetons OAuth chiffrés, colonnes illisibles côté client (droits par colonne), jamais envoyés au navigateur.
- Stockage privé, un dossier racine par entreprise, URL signées de 60 s.
- Fichiers : extensions PDF/XLSX/XLS/CSV, 25 Mo, signature binaire vérifiée, noms assainis.
- Rate limiting en base (connexion, upload, analyse, envoi, export, OAuth, actions destructives).
- Suppression de compte : révocation des accès mail, suppression des données et fichiers de l'entreprise.

## Limites connues (V1)

- Non testé ici avec de **vraies** boîtes Gmail / Microsoft 365 ni avec la **vraie** API OpenAI
  (pas d'identifiants dans l'environnement de développement) : à faire avant commercialisation,
  avec le scénario de `e2e/acceptance.spec.ts` rejoué à la main.
- La qualité d'extraction des devis PDF libres dépend du modèle OpenAI choisi (`OPENAI_MODEL`,
  `gpt-5.6-luna` par défaut, le modèle déjà utilisé par `video-intelligence`).
- Le CCTP est stocké et joignable aux consultations, mais n'est pas analysé.
- Une entreprise = un utilisateur à la création (invitation de collègues : non incluse en V1).
- Pas de Content-Security-Policy stricte (en-têtes de sécurité de base uniquement).
- Lecture des `.xls` via `@e965/xlsx` (republication npm de SheetJS 0.20.3). En production, préférer
  l'archive officielle : `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (même API).

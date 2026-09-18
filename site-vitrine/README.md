# Génération Capable — site vitrine

Site de marque "Digital Revenue Systems" pour Génération Capable — un projet
Next.js autonome, indépendant du produit existant à la racine du dépôt
(app d'abonnement/coaching, ambassadeurs, CRM, compliance : voir `../`).
Ce dossier ne modifie rien du produit existant ; il peut être déployé sur son
propre sous-domaine ou basculé plus tard.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript
- Tailwind CSS v4
- Framer Motion pour les animations (respecte `prefers-reduced-motion`)

## Développement

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

```bash
npm run build     # build de production
npm run lint      # ESLint
npm run test      # tests unitaires (Vitest)
npm run test:e2e  # tests end-to-end (Playwright, desktop + mobile)
npm run verify    # lint + tests unitaires + build
```

Les tests tournent aussi automatiquement en CI sur chaque PR touchant
`site-vitrine/` (voir `.github/workflows/site-vitrine-ci.yml`).

> Note pour les tests locaux : utiliser `http://localhost:3000` et non
> `http://127.0.0.1:3000`. Sur certains environnements le WebSocket HMR de
> Next est bloqué sur `127.0.0.1`, ce qui empêche l'hydratation côté client
> et fait échouer les tests pour une raison sans rapport avec le code.

## Architecture

- `src/app` — routes (App Router) : accueil, `/audit` (tunnel de
  qualification), `/secteurs[/[secteur]]`, `/cas-clients[/[client]]`,
  `/ressources[/[article]]`, pages piliers SEO (`/agence-web`,
  `/creation-site-internet`, `/acquisition`, `/seo`), pages légales,
  `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`.
- `src/components/sections` — sections de la page d'accueil (Hero, Problem,
  System Architecture, Capable Audit, Method, Systems, Teardowns, previews).
- `src/components/ui` — design system (Button, Badge, Card, Section, Reveal,
  AuditScore, Metric).
- `src/components/cards` — cartes de contenu (System, Sector, Article).
- `src/components/schema` — JSON-LD (Organization, WebSite, Service, Article,
  Breadcrumb).
- `src/lib/data` — contenu structuré (secteurs, systèmes, articles, cas
  clients, teardowns). `case-studies.ts` reste vide tant qu'aucun cas réel
  n'existe — voir le commentaire dans le fichier : aucun client, résultat ou
  témoignage n'est jamais inventé.
- `src/app/api/audit/route.ts` — endpoint de réception du formulaire d'audit.
  Valide la requête puis envoie, via Resend (`generationcapable.fr`, domaine
  déjà vérifié DKIM/SPF), un email de notification au propriétaire du
  business et un email de confirmation au prospect. En développement, sans
  les variables d'environnement ci-dessous, il journalise au lieu d'envoyer ;
  en production il répond 500 plutôt que d'avaler silencieusement un lead.
- `src/lib/audit-submission.ts` — validation et gabarits d'emails, isolés du
  handler pour être testables sans réseau (typage strict des champs, limites
  de longueur, échappement HTML, nettoyage du sujet, honeypot anti-bot).
- `src/lib/rate-limit.ts` — limitation de débit par IP (5 envois / 10 min).
  Empêche que le formulaire serve de relais pour envoyer des emails à des
  adresses arbitraires depuis le domaine vérifié.
- `src/lib/tracking.ts` — wrapper `dataLayer` no-op pour les événements
  (`audit_started`, `form_started`, `audit_completed`, `cta_clicked`, …), en
  attendant le branchement d'un outil d'analytics.

## Variables d'environnement

Copier `.env.example` en `.env.local` et renseigner :

- `RESEND_API_KEY` — clé Resend `sending_access` restreinte au domaine
  `generationcapable.fr` (créée pour ce formulaire).
- `AUDIT_NOTIFY_EMAIL` — adresse qui reçoit chaque nouvelle demande d'audit.
- `RESEND_FROM_EMAIL` — optionnel, expéditeur par défaut
  `Génération Capable <audit@generationcapable.fr>`.

Ces mêmes variables doivent être configurées sur la plateforme de
déploiement (Netlify, Vercel, …) avant mise en production.

## À faire avant mise en production publique

- Compléter `/mentions-legales` et `/politique-de-confidentialite` avec les
  informations réelles de l'entité (SIRET, adresse, directeur de
  publication, hébergeur) — volontairement laissées en placeholder, aucune
  information légale n'a été inventée.
- Configurer `RESEND_API_KEY` / `AUDIT_NOTIFY_EMAIL` sur la plateforme de
  déploiement (voir ci-dessus).
- Remplacer `SITE_URL` dans `src/lib/constants.ts` par le domaine définitif
  si différent de `generationcapable.fr`.
- Publier de vrais cas clients dans `src/lib/data/case-studies.ts` au fur et
  à mesure (jamais de données fictives).

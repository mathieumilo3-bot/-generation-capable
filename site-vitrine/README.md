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
npm run build   # build de production
npm run lint    # ESLint
```

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
  Aucun CRM/email n'est branché : le handler valide la requête et répond
  200/4xx, prêt à être complété sans changement côté client.
- `src/lib/tracking.ts` — wrapper `dataLayer` no-op pour les événements
  (`audit_started`, `form_started`, `audit_completed`, `cta_clicked`, …), en
  attendant le branchement d'un outil d'analytics.

## À faire avant mise en production publique

- Compléter `/mentions-legales` et `/politique-de-confidentialite` avec les
  informations réelles de l'entité.
- Brancher `POST /api/audit` sur un CRM / une notification email réelle.
- Remplacer `SITE_URL` dans `src/lib/constants.ts` par le domaine définitif
  si différent de `generationcapable.fr`.
- Publier de vrais cas clients dans `src/lib/data/case-studies.ts` au fur et
  à mesure (jamais de données fictives).

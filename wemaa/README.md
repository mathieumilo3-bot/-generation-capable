# Wemaa Services — démo de site web

Démo autonome (React + TypeScript + Tailwind CSS v4 + React Router), indépendante
du reste de ce dépôt, pensée pour être présentée à un client.

## Lancer le site en local

```bash
cd wemaa
npm install
npm run dev
```

Puis ouvrir l'URL affichée (ex. `http://localhost:5173/wemaa/`).

## Build de production

```bash
npm run build   # sortie dans wemaa/dist
npm run preview # servir le build localement
```

## Structure

- `src/data/content.ts` — tous les textes du site (hero, services, à propos,
  chiffres clés, témoignages, formulaire de devis, coordonnées, footer...).
- `src/data/images.ts` — toutes les images. Actuellement des photos de
  démonstration (banque d'images libres). **À remplacer par les vraies
  photos Wemaa Services avant mise en ligne** — il suffit de changer les
  URLs, aucun composant à modifier.
- `src/components/` — composants réutilisables (Navbar, Hero, Services,
  About, Stats, Portfolio, Testimonials, CtaFinal, Footer, Lightbox...).
- `src/pages/` — pages routées : `Home`, `Devis` (`/devis`), `Realisations`
  (`/realisations`).

## À faire avant mise en production

- Remplacer les images de démonstration par de vraies photos Wemaa Services.
- Remplacer les témoignages fictifs (`src/data/content.ts`) par de vrais avis.
- Connecter le formulaire de devis (`src/pages/Devis.tsx`) à un service
  d'envoi réel (email, CRM...) — actuellement une démo front-end uniquement.
- Ajuster les chiffres clés (`stats` dans `content.ts`) aux vrais chiffres
  de l'entreprise.
- Renseigner les vrais liens réseaux sociaux et coordonnées dans `content.ts`.

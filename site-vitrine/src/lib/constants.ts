export const SITE_NAME = "GC Agence";
export const SITE_URL = "https://gc-agence.com";
export const SITE_TAGLINE = "Site, visibilité & acquisition";

export const SITE_DESCRIPTION =
  "GC construit des sites clairs, améliore la visibilité et simplifie le parcours qui transforme un visiteur en demande, rendez-vous ou client.";

export const PRIMARY_CTA_LABEL = "Analyser mon site gratuitement";

// "Méthode" was removed: the homepage no longer renders a #methode section
// (Method.tsx is unused — the current narrative folds that explanation into
// SystemDemo/SystemArchitecture instead), so a nav item pointing at it would
// silently scroll to nowhere. Never relink it without a real section behind it.
export const NAV_LINKS = [
  { label: "Services", href: "/#services" },
  { label: "Création de site", href: "/creation-site-internet" },
  { label: "Avant / Après", href: "/#demonstration" },
  { label: "À propos", href: "/a-propos" },
] as const;

export const FOOTER_LINKS = [
  { label: "Services", href: "/solutions" },
  { label: "Création de site", href: "/creation-site-internet" },
  { label: "Avant / Après", href: "/#demonstration" },
  { label: "Ressources", href: "/ressources" },
  { label: "À propos", href: "/a-propos" },
  { label: "Audit gratuit", href: "/audit" },
] as const;

export const LEGAL_LINKS = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Politique de confidentialité", href: "/politique-de-confidentialite" },
] as const;

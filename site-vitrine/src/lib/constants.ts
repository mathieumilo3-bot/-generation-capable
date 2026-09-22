export const SITE_NAME = "GC Agence";
export const SITE_URL = "https://gc-agence.com";
export const SITE_TAGLINE = "Acquisition digitale pour artisans & BTP";

export const SITE_DESCRIPTION =
  "GC aide les artisans et entreprises du BTP à être trouvés, à rassurer et à transformer leur présence en demandes de devis qualifiées.";

export const PRIMARY_CTA_LABEL = "Analyser mon site gratuitement";

// "Méthode" was removed: the homepage no longer renders a #methode section
// (Method.tsx is unused — the current narrative folds that explanation into
// SystemDemo/SystemArchitecture instead), so a nav item pointing at it would
// silently scroll to nowhere. Never relink it without a real section behind it.
export const NAV_LINKS = [
  { label: "Création de site", href: "/creation-site-internet" },
  { label: "Solutions", href: "/solutions" },
  { label: "Avis clients", href: "/#avis-clients" },
  { label: "Ressources", href: "/ressources" },
] as const;

export const FOOTER_LINKS = [
  { label: "Création de site", href: "/creation-site-internet" },
  { label: "Marketing digital", href: "/solutions/agence-marketing-digital" },
  { label: "Génération de leads", href: "/solutions/generation-de-leads" },
  { label: "Acquisition B2B", href: "/solutions/generation-leads-b2b" },
  { label: "Google Ads", href: "/solutions/publicite-google-ads" },
  { label: "SEO local", href: "/solutions/referencement-local" },
  { label: "SEO", href: "/seo" },
  { label: "Solutions", href: "/solutions" },
  { label: "Secteurs", href: "/secteurs" },
  { label: "Ressources", href: "/ressources" },
  { label: "À propos", href: "/a-propos" },
  { label: "Étude de cas GC", href: "/realisations/gc-agence" },
  { label: "Audit", href: "/audit" },
] as const;

export const LEGAL_LINKS = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Politique de confidentialité", href: "/politique-de-confidentialite" },
] as const;

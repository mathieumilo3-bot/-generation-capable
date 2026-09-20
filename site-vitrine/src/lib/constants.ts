export const SITE_NAME = "GC";
export const SITE_URL = "https://gc-agence.com";
export const SITE_TAGLINE = "Digital Revenue Systems";

export const SITE_DESCRIPTION =
  "GC conçoit les systèmes digitaux qui transforment la visibilité, le trafic et l'attention d'une entreprise en opportunités commerciales.";

export const PRIMARY_CTA_LABEL = "Analyser mon entreprise";

// "Méthode" was removed: the homepage no longer renders a #methode section
// (Method.tsx is unused — the current narrative folds that explanation into
// SystemDemo/SystemArchitecture instead), so a nav item pointing at it would
// silently scroll to nowhere. Never relink it without a real section behind it.
export const NAV_LINKS = [
  { label: "Systèmes", href: "/#systemes" },
  { label: "Solutions", href: "/solutions" },
  { label: "Secteurs", href: "/secteurs" },
  { label: "Applications", href: "/applications" },
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
  { label: "Audit", href: "/audit" },
] as const;

export const LEGAL_LINKS = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Politique de confidentialité", href: "/politique-de-confidentialite" },
] as const;

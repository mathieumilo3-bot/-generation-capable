import type { Metadata } from "next";
import { PillarPage } from "@/components/sections/PillarPage";

export const metadata: Metadata = {
  title: "SEO",
  description:
    "Un référencement naturel construit sur une architecture technique solide, un maillage interne cohérent et un contenu qui répond à de vraies questions.",
  alternates: { canonical: "/seo" },
};

export default function SeoPage() {
  return (
    <PillarPage
      eyebrow="Référencement naturel"
      title="Le SEO comme fondation, pas comme option."
      intro="Un bon référencement ne se limite pas à des mots-clés. Il repose sur une architecture technique propre, un maillage interne cohérent et un contenu qui répond réellement aux questions des clients."
      path="/seo"
      ctaContext="pillar_seo"
      blocks={[
        {
          heading: "Une architecture technique excellente",
          body: "Métadonnées, sitemap, robots, structure de titres, performance : les fondations techniques conditionnent tout le reste.",
        },
        {
          heading: "Un maillage pensé dès la conception",
          body: "Secteurs, cas clients et ressources sont reliés entre eux pour construire progressivement l'autorité du site, sans générer de pages artificielles.",
        },
        {
          heading: "Un contenu qui répond à de vraies questions",
          body: "Chaque article ou page sectorielle part d'un problème réel plutôt que d'un mot-clé isolé.",
        },
      ]}
    />
  );
}

import type { Metadata } from "next";
import { PillarPage } from "@/components/sections/PillarPage";

export const metadata: Metadata = {
  title: "Agence SEO pour PME : référencement et visibilité Google",
  description:
    "Agence SEO pour PME : audit, architecture technique, contenus, maillage interne, SEO local et suivi des positions pour gagner en visibilité Google.",
  alternates: { canonical: "/seo" },
};

export default function SeoPage() {
  return (
    <PillarPage
      eyebrow="Référencement naturel"
      title="Agence SEO pour PME : gagnez en visibilité sur les recherches qui comptent."
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
        {
          heading: "Des pages commerciales reliées aux intentions d'achat",
          body: "Les requêtes d'audit, de prix, de comparaison, de prestation et de secteur ne doivent pas toutes aboutir sur la même page. Nous organisons les contenus pour que chaque intention importante dispose d'une destination claire et reliée au reste du site.",
        },
        {
          heading: "SEO local pour les entreprises qui travaillent par zone",
          body: "Lorsque la demande dépend d'une zone géographique, le site, les pages de services et Google Business Profile doivent envoyer des signaux cohérents. Les zones doivent correspondre à l'activité réellement servie, sans multiplication de pages artificielles.",
        },
        {
          heading: "Pilotage par Search Console et conversions",
          body: "Le suivi porte sur les impressions, clics, requêtes, positions et pages qui progressent, puis sur les formulaires et rendez-vous générés. L'objectif est de renforcer ce qui attire des prospects qualifiés, pas seulement de faire monter un nombre de mots-clés.",
        },
      ]}
    />
  );
}

import type { Metadata } from "next";
import { PillarPage } from "@/components/sections/PillarPage";

export const metadata: Metadata = {
  title: "Agence web : création de site, SEO et acquisition",
  description:
    "Agence web pour entreprises, artisans et PME : création de site, SEO, acquisition, conversion et génération de leads dans un système digital cohérent.",
  alternates: { canonical: "/agence-web" },
};

export default function AgenceWebPage() {
  return (
    <PillarPage
      eyebrow="Positionnement"
      title="Agence web : création de site, SEO, acquisition et conversion."
      intro="La plupart des agences web livrent un site et s'arrêtent là. Nous construisons le système qui l'entoure — acquisition, conversion, qualification — parce qu'un site seul ne suffit plus à générer des opportunités."
      path="/agence-web"
      ctaContext="pillar_agence_web"
      blocks={[
        {
          heading: "Une méthode, pas un catalogue",
          body: "Analyser, construire, connecter, optimiser : chaque projet suit la même méthode, pensée pour produire un résultat mesurable plutôt qu'une simple livraison.",
        },
        {
          heading: "Quatre systèmes qui fonctionnent ensemble",
          body: "Presence, Acquisition, Conversion et Growth ne sont pas des prestations séparées : ce sont les composants d'un même système, conçus pour s'articuler.",
        },
        {
          heading: "Orientés opportunités commerciales",
          body: "L'objectif n'est jamais l'esthétique seule : c'est la transformation de la visibilité, du trafic et de l'attention en prises de contact réelles.",
        },
      ]}
    />
  );
}

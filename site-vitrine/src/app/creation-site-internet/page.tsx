import type { Metadata } from "next";
import { PillarPage } from "@/components/sections/PillarPage";

export const metadata: Metadata = {
  title: "Création de site internet",
  description:
    "Un site premium pensé comme un système : architecture, expérience et parcours orientés vers la prise de contact, pas seulement l'apparence.",
  alternates: { canonical: "/creation-site-internet" },
};

export default function CreationSiteInternetPage() {
  return (
    <PillarPage
      eyebrow="Presence"
      title="Création de site internet"
      intro="Un site n'est pas une brochure. C'est l'actif digital qui porte votre crédibilité et déclenche la première action du visiteur."
      path="/creation-site-internet"
      ctaContext="pillar_creation_site"
      blocks={[
        {
          heading: "Une architecture pensée pour convertir",
          body: "Chaque page a un objectif unique. La structure du site guide le visiteur vers une action claire plutôt que de tout dire à la fois.",
        },
        {
          heading: "Une expérience rapide et sobre",
          body: "Performance et sobriété visuelle ne s'opposent pas au premium — elles en sont la condition. Un site lent ou surchargé perd des opportunités avant même d'avoir convaincu.",
        },
        {
          heading: "Connecté au reste du système",
          body: "Le site n'existe pas seul : il s'articule avec l'acquisition en amont et la conversion en aval, dans une même mécanique.",
        },
      ]}
    />
  );
}

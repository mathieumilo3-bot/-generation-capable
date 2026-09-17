import type { Metadata } from "next";
import { PillarPage } from "@/components/sections/PillarPage";

export const metadata: Metadata = {
  title: "Acquisition digitale",
  description:
    "SEO, contenu, réseaux sociaux : faire venir la bonne attention, au bon moment de la décision, plutôt que du trafic générique.",
  alternates: { canonical: "/acquisition" },
};

export default function AcquisitionPage() {
  return (
    <PillarPage
      eyebrow="System 02"
      title="Acquisition"
      intro="La visibilité ne vaut que si elle amène les bonnes personnes. L'acquisition n'est pas une question de volume, mais de pertinence."
      path="/acquisition"
      ctaContext="pillar_acquisition"
      blocks={[
        {
          heading: "SEO et contenu",
          body: "Construire une visibilité qui dure, en répondant précisément aux questions que se posent vos clients avant de vous contacter.",
        },
        {
          heading: "Réseaux sociaux comme canal, pas comme vitrine",
          body: "Chaque publication doit ramener vers un point de conversion unique, plutôt que de se disperser en engagement sans suite.",
        },
        {
          heading: "Mesurée dès le premier jour",
          body: "Sans tracking, l'acquisition reste une intuition. Chaque canal est relié au système de conversion pour être évalué sur des résultats réels.",
        },
      ]}
    />
  );
}

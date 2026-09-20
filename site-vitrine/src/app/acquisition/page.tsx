import type { Metadata } from "next";
import { PillarPage } from "@/components/sections/PillarPage";

export const metadata: Metadata = {
  title: "Acquisition digitale : générer des leads qualifiés",
  description:
    "Acquisition digitale pour générer des leads qualifiés : SEO, contenu, réseaux sociaux, pages de conversion, qualification et suivi des demandes.",
  alternates: { canonical: "/acquisition" },
};

export default function AcquisitionPage() {
  return (
    <PillarPage
      eyebrow="System 02"
      title="Acquisition digitale : attirer et convertir des prospects qualifiés."
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
          body: "Chaque publication doit ramener vers un point de conversion unique, plutôt que de se disperser en engagements sans lendemain.",
        },
        {
          heading: "Mesurée dès le premier jour",
          body: "Sans tracking, l'acquisition reste une intuition. Chaque canal est relié au système de conversion pour être évalué sur des résultats réels.",
        },
      ]}
    />
  );
}

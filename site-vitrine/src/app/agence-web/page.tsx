import type { Metadata } from "next";
import { PillarPage } from "@/components/sections/PillarPage";

export const metadata: Metadata = {
  title: "Agence web pour PME et artisans : site, SEO et acquisition",
  description:
    "Agence web pour PME et artisans : création de site internet, SEO, acquisition, conversion et génération de leads dans un système digital cohérent.",
  alternates: { canonical: "/agence-web" },
};

export default function AgenceWebPage() {
  return (
    <PillarPage
      eyebrow="Positionnement"
      title="Agence web pour PME et artisans : site, SEO, acquisition et conversion."
      intro="GC Agence accompagne les PME et artisans dans la création de leur site et du parcours qui transforme une visite en demande : visibilité, présentation des prestations, contact et suivi commercial. Le diagnostic sert à choisir les priorités adaptées à votre situation."
      path="/agence-web"
      ctaContext="pillar_agence_web"
      relatedLinks={[
        { href: "/creation-site-internet", label: "Créer votre site", description: "Définir les pages, les fonctions et les vérifications avant livraison." },
        { href: "/seo", label: "Développer votre visibilité", description: "Travailler les recherches liées aux prestations que vous vendez." },
        { href: "/solutions/marketing-digital-pme", label: "Marketing pour PME", description: "Choisir les canaux en fonction de vos clients et de vos moyens." },
        { href: "/ressources/agence-web-ou-freelance", label: "Choisir votre prestataire", description: "Comparer le périmètre, les responsabilités et le suivi proposé." },
      ]}
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
        {
          heading: "Une architecture adaptée aux PME et artisans",
          body: "Les prestations, secteurs, zones réellement servies, réalisations et questions fréquentes sont structurés pour que les visiteurs comme Google comprennent rapidement ce que l'entreprise propose et à qui.",
        },
        {
          heading: "Création de site et SEO pensés ensemble",
          body: "Le référencement n'est pas ajouté après la mise en ligne. Titres, pages de services, maillage, performance et données structurées sont intégrés à la conception pour éviter de reconstruire le socle quelques mois plus tard.",
        },
        {
          heading: "Un parcours vers le devis ou le rendez-vous",
          body: "Chaque source de trafic doit déboucher sur une prochaine étape claire : diagnostic, devis, formulaire ou rendez-vous. Le suivi des conversions permet ensuite d'identifier les pages et canaux qui produisent réellement des demandes.",
        },
      ]}
    />
  );
}

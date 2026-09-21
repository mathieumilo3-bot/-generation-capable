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
      relatedLinks={[
        { href: "/solutions/audit-seo", label: "Audit SEO", description: "Identifier les freins techniques et les pages à travailler en priorité." },
        { href: "/solutions/referencement-local", label: "Référencement local", description: "Relier vos prestations, vos zones d'intervention et votre présence Google." },
        { href: "/solutions/google-business-profile", label: "Google Business Profile", description: "Rendre votre fiche cohérente avec votre activité et votre site." },
        { href: "/ressources/prix-referencement-seo", label: "Budget SEO", description: "Comprendre les livrables et les facteurs qui font varier le budget." },
      ]}
      blocks={[
        {
          heading: "Des fondations techniques vérifiées",
          body: "Métadonnées, sitemap, robots, structure de titres, performance : les fondations techniques conditionnent tout le reste.",
        },
        {
          heading: "Un maillage pensé dès la conception",
          body: "Les pages de prestations sont reliées aux guides et aux exemples pertinents pour aider le visiteur à avancer. Chaque lien doit apporter un complément utile : comprendre un budget, choisir une solution ou préparer une demande. Cette organisation aide aussi les moteurs à découvrir les pages.",
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
        {
          heading: "Que reçoit votre entreprise après le diagnostic ?",
          body: "Le diagnostic distingue les problèmes observés, les pages concernées et les actions recommandées. Le périmètre de l'accompagnement précise ensuite les corrections techniques, les contenus à produire et les indicateurs à suivre. Une priorité doit pouvoir être expliquée par un blocage d'accès, une demande pertinente ou une difficulté rencontrée par vos prospects.",
        },
        {
          heading: "Comment juger les premiers résultats ?",
          body: "Une page accessible et indexable n'est pas nécessairement indexée, et une indexation ne garantit pas une position. Le suivi commence par l'exploration et l'indexation, puis les impressions et clics sur les recherches utiles. Les demandes qualifiées restent le critère commercial. Les délais dépendent du site et de la concurrence ; aucune première place n'est promise.",
        },
      ]}
    />
  );
}

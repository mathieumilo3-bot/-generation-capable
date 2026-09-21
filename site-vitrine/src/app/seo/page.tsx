import type { Metadata } from "next";
import { PillarPage } from "@/components/sections/PillarPage";

export const metadata: Metadata = {
  title: "Agence SEO PME : référencement orienté prospects | GC Agence",
  description:
    "Agence SEO pour PME : audit, pages commerciales, contenu, maillage interne et SEO local pour attirer des recherches utiles et transformer les clics en demandes.",
  alternates: { canonical: "/seo" },
};

export default function SeoPage() {
  return (
    <PillarPage
      eyebrow="Référencement naturel"
      title="Agence SEO pour PME : attirer des prospects depuis les recherches qui comptent."
      intro="Le référencement utile ne consiste pas à multiplier les articles ni les mots-clés. Il faut identifier les recherches proches d'un besoin commercial, construire les bonnes pages, renforcer leur crédibilité et mesurer les demandes générées."
      path="/seo"
      ctaContext="pillar_seo"
      relatedLinks={[
        { href: "/solutions/audit-seo", label: "Audit SEO", description: "Identifier les freins techniques et les pages à travailler en priorité." },
        { href: "/solutions/referencement-local", label: "Référencement local", description: "Relier vos prestations, vos zones d'intervention et votre présence Google." },
        { href: "/solutions/google-business-profile", label: "Google Business Profile", description: "Rendre votre fiche cohérente avec votre activité et votre site." },
        { href: "/solutions/generation-de-leads", label: "Génération de leads", description: "Relier les visites organiques aux formulaires, devis et rendez-vous qualifiés." },
        { href: "/ressources/prix-referencement-seo", label: "Budget SEO", description: "Comprendre les livrables et les facteurs qui font varier le budget." },
        { href: "/ressources/comment-etre-visible-sur-google", label: "Visibilité Google", description: "Comprendre les leviers qui permettent à une page utile d'être découverte et choisie." },
      ]}
      blocks={[
        {
          heading: "Prioriser les recherches commerciales avant le volume",
          body: "Nous séparons les recherches d'information des recherches proches d'une décision : agence, devis, prix, service précis, comparaison, problème concret ou besoin local. Le but est de renforcer d'abord les pages qui peuvent mener à une vraie prise de contact.",
        },
        {
          heading: "Renforcer les pages existantes avant d'en créer davantage",
          body: "Titres, H1, contenu, structure, preuves et liens internes sont revus page par page. Une page déjà pertinente mais trop faible mérite souvent d'être améliorée avant de lancer une série de nouvelles URL.",
        },
        {
          heading: "Créer un maillage qui aide le prospect à avancer",
          body: "Les pages commerciales sont reliées aux guides qui répondent aux objections : budget, méthode, comparaison, SEO local, création de site ou acquisition. Chaque lien interne doit avoir une utilité pour le lecteur, pas seulement pour le moteur.",
        },
        {
          heading: "Des preuves vérifiables plutôt que des promesses SEO",
          body: "Nous privilégions les éléments contrôlables : pages publiées, corrections techniques, contenus ajoutés, requêtes suivies, formulaires et rendez-vous reçus. Aucune position n'est garantie et aucun résultat client n'est affiché sans preuve identifiable.",
        },
        {
          heading: "SEO local sans fabriquer de fausses villes",
          body: "Pour une entreprise qui travaille par zone, les services, la fiche Google et les pages locales doivent rester cohérents avec la réalité de l'activité. Nous évitons les dizaines de pages quasi identiques pour des communes non réellement documentées.",
        },
        {
          heading: "Mesurer jusqu'à la demande qualifiée",
          body: "Search Console permet d'observer impressions, clics, requêtes et pages. Le suivi commercial doit ensuite distinguer formulaires, rendez-vous, demandes de devis et qualité des opportunités afin de renforcer ce qui apporte réellement du business.",
        },
        {
          heading: "Quand une page mérite d'être créée",
          body: "Une nouvelle page est justifiée lorsqu'une intention importante n'a pas de destination claire : un service distinct, un secteur, un audit, une comparaison ou une question d'achat. Elle doit apporter une réponse spécifique et être reliée au reste du site.",
        },
      ]}
      commercialSection={{
        heading: "Ce que nous regardons avant de proposer un plan SEO",
        intro: "Le diagnostic sert à transformer une demande vague de « mieux remonter sur Google » en un plan relié à vos offres et à vos conversions.",
        points: [
          {
            heading: "Recherches à forte intention",
            body: "Les requêtes où un prospect cherche déjà un prestataire, un devis, un prix, une solution ou un service précis.",
          },
          {
            heading: "Pages capables de convertir",
            body: "Les pages qui doivent expliquer l'offre, rassurer, répondre aux objections et proposer une action mesurable.",
          },
          {
            heading: "Preuves disponibles",
            body: "Avis vérifiables, réalisations, références publiques, certifications ou méthode documentée — sans inventer ce qui n'existe pas.",
          },
          {
            heading: "Mesure commerciale",
            body: "Le suivi ne s'arrête pas aux positions : nous cherchons à relier les recherches aux formulaires, rendez-vous et opportunités.",
          },
        ],
        proofNote: "Les positions peuvent évoluer après publication et dépendent notamment de la concurrence, de l'autorité du domaine et des signaux externes. Une amélioration publiée n'est donc jamais présentée comme un gain de classement tant qu'il n'est pas réellement observé.",
      }}
    />
  );
}

import type { Metadata } from "next";
import { PillarPage } from "@/components/sections/PillarPage";

export const metadata: Metadata = {
  title: "Création de site internet professionnel pour entreprise",
  description:
    "Création de site internet professionnel pour artisans, TPE et PME : design, performance, SEO, pages de services et parcours orienté devis ou rendez-vous.",
  alternates: { canonical: "/creation-site-internet" },
};

export default function CreationSiteInternetPage() {
  return (
    <PillarPage
      eyebrow="Création de site internet"
      title="Création de site internet professionnel qui transforme les visites en demandes."
      intro="Un site n'est pas une brochure. C'est l'actif digital qui porte votre crédibilité et déclenche la première action du visiteur."
      path="/creation-site-internet"
      ctaContext="pillar_creation_site"
      relatedLinks={[
        { href: "/solutions/creation-site-artisan", label: "Site pour artisan", description: "Prestations, réalisations et demandes de devis adaptées à votre métier." },
        { href: "/solutions/site-internet-pme", label: "Site pour PME", description: "Organiser plusieurs offres et orienter chaque visiteur vers le bon contact." },
        { href: "/ressources/prix-creation-site-internet", label: "Comprendre un devis de site", description: "Les postes à comparer et les coûts récurrents à clarifier." },
        { href: "/ressources/refonte-site-sans-perdre-seo", label: "Préparer une refonte", description: "Préserver les pages et les liens qui apportent déjà du trafic." },
      ]}
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
        {
          heading: "Quelles pages prévoir pour votre entreprise ?",
          body: "Commencez par une page d'accueil claire, une page par prestation réellement distincte, une présentation de l'entreprise et un moyen de contact. Ajoutez vos réalisations lorsque vous disposez de photos et d'informations publiables. Pour un artisan, précisez les interventions et la zone réellement couverte ; pour une PME, expliquez à quels clients chaque offre s'adresse.",
        },
        {
          heading: "Ce qu'il faut définir avant le devis",
          body: "Le budget dépend du nombre de pages, de la rédaction, des contenus disponibles et des fonctions à connecter. Précisez qui fournit les textes et les photos, qui possède le domaine, comment vous pourrez modifier le site et quels frais d'hébergement ou de maintenance restent à prévoir. Une réservation, un paiement ou un espace client doit être chiffré explicitement.",
        },
        {
          heading: "Les vérifications avant la mise en ligne",
          body: "Le contrôle porte sur l'affichage mobile, les formulaires et leur réception, les liens, le HTTPS, les titres, les URL canoniques et le sitemap. Lors d'une refonte, les anciennes adresses utiles sont associées à leur nouvelle destination. Le suivi distingue ensuite les visites des demandes réellement reçues, avec les consentements nécessaires.",
        },
        {
          heading: "Votre site existe déjà ?",
          body: "Un diagnostic permet de décider entre améliorer quelques pages et reconstruire le site. Si vos visiteurs trouvent déjà vos prestations mais abandonnent le formulaire, la priorité peut être le parcours de contact. Si vos services restent introuvables ou difficiles à comprendre, la structure et les contenus sont à revoir avant d'augmenter le trafic.",
        },
      ]}
    />
  );
}

import type { Metadata } from "next";
import { PillarPage } from "@/components/sections/PillarPage";

export const metadata: Metadata = {
  title: "Création de site internet pour PME & artisans",
  description:
    "Création de site internet pour artisans, TPE et PME : pages de services, SEO, preuves réelles et parcours orienté demandes de devis ou rendez-vous.",
  alternates: { canonical: "/creation-site-internet" },
};

export default function CreationSiteInternetPage() {
  return (
    <PillarPage
      eyebrow="Création de site internet"
      title="Création de site internet pour artisans et PME : un site pensé pour générer des demandes."
      intro="Votre futur client doit comprendre ce que vous faites, vérifier qu'il peut vous faire confiance et savoir comment demander un devis ou prendre rendez-vous. Nous construisons le site autour de ce parcours, pas autour d'un simple effet visuel."
      path="/creation-site-internet"
      ctaContext="pillar_creation_site"
      relatedLinks={[
        { href: "/solutions/creation-site-artisan", label: "Site pour artisan", description: "Prestations, réalisations et demandes de devis adaptées à votre métier." },
        { href: "/solutions/site-internet-pme", label: "Site pour PME", description: "Organiser plusieurs offres et orienter chaque visiteur vers le bon contact." },
        { href: "/solutions/audit-site-internet", label: "Audit de site", description: "Identifier les freins de visibilité, de confiance et de conversion avant une refonte." },
        { href: "/solutions/generation-de-leads", label: "Génération de leads", description: "Relier le site aux formulaires, rendez-vous et demandes réellement qualifiées." },
        { href: "/ressources/prix-creation-site-internet", label: "Comprendre un devis de site", description: "Les postes à comparer et les coûts récurrents à clarifier." },
        { href: "/ressources/refonte-site-sans-perdre-seo", label: "Préparer une refonte", description: "Préserver les pages et les liens qui apportent déjà du trafic." },
      ]}
      blocks={[
        {
          heading: "Une page pour chaque service qui mérite d'être trouvé",
          body: "Une page d'accueil générale ne suffit pas si vos prospects recherchent des prestations différentes. Nous structurons les services prioritaires séparément quand ils correspondent à des besoins et des recherches distincts, puis nous les relions avec un maillage interne logique.",
        },
        {
          heading: "Un parcours de devis visible sur mobile",
          body: "Le visiteur doit pouvoir agir sans chercher : demander un devis, réserver un échange, appeler ou envoyer les informations utiles au projet. Le parcours est pensé pour réduire les hésitations et rester simple sur smartphone.",
        },
        {
          heading: "Des preuves réelles, placées au bon endroit",
          body: "Photos de réalisations, certifications, méthode, avis vérifiables et informations sur l'entreprise rassurent davantage qu'une promesse générique. Nous n'inventons ni témoignages, ni chiffres de résultats, ni implantations locales.",
        },
        {
          heading: "Une base SEO intégrée avant la mise en ligne",
          body: "Titres, H1, URL canoniques, pages de services, liens internes, sitemap et indexabilité sont vérifiés avant publication. Pour une activité locale, les zones présentées doivent correspondre aux zones réellement servies.",
        },
        {
          heading: "Ce qui doit être défini avant le devis",
          body: "Le périmètre dépend du nombre de pages, des services à mettre en avant, des contenus disponibles et des fonctions nécessaires. Le devis doit préciser qui fournit les textes et photos, les intégrations, l'hébergement, la maintenance éventuelle et ce qui reste sous votre contrôle.",
        },
        {
          heading: "Refonte ou amélioration ciblée ?",
          body: "Un site existant n'a pas forcément besoin d'être reconstruit. Si les bonnes pages existent déjà, il peut être plus rentable de corriger le message, les preuves, le maillage ou le formulaire. Le diagnostic sert à choisir la priorité avant de lancer des travaux inutiles.",
        },
      ]}
      commercialSection={{
        heading: "Ce que nous clarifions avant de construire",
        intro: "L'objectif est d'arriver au rendez-vous avec un besoin précis et un périmètre utile, pas avec une liste de fonctionnalités sans lien avec les demandes de vos prospects.",
        points: [
          {
            heading: "Services prioritaires",
            body: "Les prestations qui doivent disposer de leur propre page et celles qui peuvent rester regroupées.",
          },
          {
            heading: "Action attendue",
            body: "Devis, appel, rendez-vous ou formulaire : une prochaine étape principale selon votre cycle de vente.",
          },
          {
            heading: "Preuves disponibles",
            body: "Réalisations, avis vérifiables, certifications, équipe, méthode et éléments que le prospect peut réellement contrôler.",
          },
          {
            heading: "Mesure des demandes",
            body: "Formulaires, prises de rendez-vous et autres conversions utiles sont distingués du simple volume de visites.",
          },
        ],
        proofNote: "Aucun faux avis, faux cas client ou résultat inventé n'est ajouté pour remplir la page. Quand une preuve manque, nous préférons expliquer la méthode et créer l'emplacement pour une preuve réelle à venir.",
      }}
    />
  );
}

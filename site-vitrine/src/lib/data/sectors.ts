export type Sector = {
  slug: string;
  name: string;
  label: string;
  /** Grammatically correct French phrase for "pensé pour ___" (with article). */
  forPhrase: string;
  problem: string;
  recommendedSystem: string;
  example: string;
  metaDescription: string;
};

export const SECTORS: Sector[] = [
  {
    slug: "restaurants",
    name: "Restaurants",
    label: "Restauration",
    forPhrase: "les restaurants",
    problem:
      "Une carte attractive et de bons avis ne suffisent pas si la page d'accueil ne pousse personne à réserver dans les dix premières secondes.",
    recommendedSystem:
      "Un site rapide centré sur la réservation, avec un système de conversion qui capte l'intention avant qu'elle ne se disperse sur une autre plateforme.",
    example:
      "Type d'application : remplacer un menu PDF illisible sur mobile par une page de réservation directe, sans commission de plateforme tierce.",
    metaDescription:
      "Système digital pour restaurants : présence, réservation directe et visibilité locale, sans dépendre des plateformes tierces.",
  },
  {
    slug: "cabinets",
    name: "Cabinets",
    label: "Cabinets & professions réglementées",
    forPhrase: "les cabinets et professions réglementées",
    problem:
      "La confiance se joue avant le premier échange. Un site daté ou une prise de contact compliquée jette un doute sur le sérieux du cabinet.",
    recommendedSystem:
      "Un système de présence sobre et crédible, associé à une prise de rendez-vous qualifiée qui filtre les demandes en amont.",
    example:
      "Type d'application : un parcours de prise de rendez-vous en trois questions qui qualifie la demande avant l'appel.",
    metaDescription:
      "Système digital pour cabinets et professions réglementées : crédibilité, clarté et prise de rendez-vous qualifiée.",
  },
  {
    slug: "immobilier",
    name: "Immobilier",
    label: "Immobilier",
    forPhrase: "l'immobilier",
    problem:
      "Le volume d'annonces et de portails dilue la marque de l'agence. Le visiteur retient le bien, rarement l'agence qui l'a diffusé.",
    recommendedSystem:
      "Une présence qui capitalise sur chaque annonce pour construire la marque de l'agence, connectée à un système de qualification des acheteurs et vendeurs.",
    example:
      "Type d'application : une page de biens qui redirige systématiquement vers une estimation gratuite plutôt qu'un simple formulaire de contact.",
    metaDescription:
      "Système digital pour agences immobilières : présence de marque, captation de mandats et qualification des contacts.",
  },
  {
    slug: "beaute",
    name: "Beauté",
    label: "Beauté & bien-être",
    forPhrase: "la beauté et le bien-être",
    problem:
      "Instagram génère de l'attention, mais la prise de rendez-vous reste souvent manuelle, par message, avec des allers-retours qui font perdre des clientes.",
    recommendedSystem:
      "Un système d'acquisition qui relie les réseaux sociaux à une prise de rendez-vous en ligne instantanée, sans échange manuel.",
    example:
      "Type d'application : un lien unique en bio qui ouvre directement l'agenda, au lieu d'un renvoi vers les messages privés.",
    metaDescription:
      "Système digital pour instituts de beauté et bien-être : réseaux sociaux connectés à une prise de rendez-vous instantanée.",
  },
  {
    slug: "artisans",
    name: "Artisans",
    label: "Artisans & métiers manuels",
    forPhrase: "les artisans et métiers manuels",
    problem:
      "Le bouche-à-oreille fonctionne, mais il ne suffit plus à remplir un planning toute l'année, et il ne se voit pas en ligne.",
    recommendedSystem:
      "Une présence qui donne à voir le savoir-faire réel, associée à un système de demande de devis qui qualifie le chantier avant le premier appel.",
    example:
      "Type d'application : une galerie de réalisations classée par type de chantier, reliée à un formulaire de devis en trois champs.",
    metaDescription:
      "Système digital pour artisans : visibilité locale, preuve du savoir-faire et devis qualifiés en ligne.",
  },
  {
    slug: "services",
    name: "Services",
    label: "Entreprises de services",
    forPhrase: "les entreprises de services",
    problem:
      "L'offre est parfois difficile à expliquer en une phrase, et le site tente de tout dire à la fois, au risque de ne convaincre personne.",
    recommendedSystem:
      "Une architecture de présence qui hiérarchise l'offre par problème client, connectée à un système de qualification avant rendez-vous.",
    example:
      "Type d'application : une page d'accueil organisée autour de trois problèmes clients plutôt que d'une liste de prestations.",
    metaDescription:
      "Système digital pour entreprises de services : clarté de l'offre et qualification des demandes avant rendez-vous.",
  },
  {
    slug: "coachs",
    name: "Coachs",
    label: "Coachs & indépendants",
    forPhrase: "les coachs et indépendants",
    problem:
      "L'activité repose sur la personne, mais la présence en ligne ressemble à un CV plutôt qu'à un système qui déclenche la prise de contact.",
    recommendedSystem:
      "Un système de conversion structuré autour d'un appel découverte, avec une qualification qui filtre les profils avant l'agenda.",
    example:
      "Type d'application : un tunnel de qualification en trois étapes avant l'accès au calendrier de réservation.",
    metaDescription:
      "Système digital pour coachs et indépendants : positionnement clair et tunnel de qualification avant l'appel découverte.",
  },
  {
    slug: "entreprises-locales",
    name: "Entreprises locales",
    label: "Entreprises locales",
    forPhrase: "les entreprises locales",
    problem:
      "La visibilité locale dépend de fiches et d'avis dispersés sur plusieurs plateformes, sans point central qui convertit vraiment.",
    recommendedSystem:
      "Une présence centrale qui consolide la visibilité locale et redirige chaque canal vers un seul parcours de conversion.",
    example:
      "Type d'application : une page qui centralise avis, itinéraire et prise de contact pour ne plus disperser l'attention locale.",
    metaDescription:
      "Système digital pour entreprises locales : visibilité consolidée et parcours de conversion unique.",
  },
];

export function getSectorBySlug(slug: string): Sector | undefined {
  return SECTORS.find((sector) => sector.slug === slug);
}

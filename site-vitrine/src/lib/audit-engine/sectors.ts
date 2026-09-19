import type { SectorProfile } from "./types";

/**
 * Sector heuristics for the audit engine.
 *
 * These are NOT universal truths — they are matching priors used to weight
 * which findings matter most for a given declared activity, and each one
 * says explicitly where it stops being reliable (`limits`). A restaurant and
 * a SaaS company both care about "trust", but for very different reasons;
 * this file is what lets the engine tell the difference instead of scoring
 * every business against the same checklist.
 *
 * Add a sector by appending a profile and a few `matches` keywords — nothing
 * else in the engine needs to change (see classify.ts).
 */
export const SECTOR_PROFILES: SectorProfile[] = [
  {
    id: "dentiste_sante",
    label: "Dentiste / santé dentaire",
    matches: ["dentiste", "dentaire", "orthodont", "chirurgien-dentiste", "cabinet dentaire"],
    priorityDimensions: ["trust", "conversion", "positioning"],
    trustSignals: [
      "identité et qualifications du praticien",
      "photos réelles du cabinet",
      "modalités de prise de rendez-vous claires",
      "prise en charge / tiers payant explicite",
    ],
    channels: ["recherche locale (Google)", "recommandation", "fiche Google Business"],
    commonObjections: ["douleur/anxiété perçue", "coût non pris en charge", "délai d'obtention d'un rendez-vous"],
    conversionLevers: ["prise de rendez-vous en ligne", "réponse aux urgences", "clarté des tarifs de base"],
    typicalOpportunities: ["qualifier les urgences en amont", "afficher les créneaux disponibles"],
    limits:
      "Le secteur médical est réglementé : nous n'évaluons ni la qualité des soins ni les tarifs pratiqués, seulement la présence digitale et le parcours de prise de contact.",
  },
  {
    id: "coach",
    label: "Coach / accompagnement individuel",
    matches: ["coach", "coaching", "accompagnement", "mentor", "mentorat"],
    priorityDimensions: ["positioning", "psychology", "trust"],
    trustSignals: ["résultats de clients réels", "méthode nommée et explicite", "identité du coach visible"],
    channels: ["Instagram", "LinkedIn", "TikTok", "recommandation", "contenu"],
    commonObjections: [
      "scepticisme sur le sérieux de la méthode",
      "peur de perdre du temps ou de l'argent",
      "comparaison avec des offres gratuites",
    ],
    conversionLevers: ["appel découverte gratuit", "témoignages spécifiques", "promesse de transformation claire"],
    typicalOpportunities: ["clarifier la transformation promise", "structurer une offre d'entrée à faible friction"],
    limits:
      "Un positionnement de coaching se juge beaucoup sur la personnalité et le ton — l'engin lit le texte de la page, pas la présence en vidéo ou en rendez-vous.",
  },
  {
    id: "consultant",
    label: "Consultant / expertise B2B",
    matches: ["consultant", "consulting", "conseil aux entreprises", "expert-conseil"],
    priorityDimensions: ["positioning", "trust", "offer"],
    trustSignals: ["références clients nommées", "spécialisation claire", "publications ou prises de parole"],
    channels: ["LinkedIn", "recommandation", "réseau professionnel", "SEO spécialisé"],
    commonObjections: [
      "généralité perçue de l'offre",
      "difficulté à évaluer le ROI avant de s'engager",
      "préférence pour un acteur déjà connu",
    ],
    conversionLevers: ["étude de cas chiffrée", "premier échange cadré", "spécialisation nette sur un problème"],
    typicalOpportunities: ["remplacer un site généraliste par une offre spécialisée sur un problème précis"],
    limits: "La confiance B2B se construit aussi hors-site (réseau, recommandations) — non observable ici.",
  },
  {
    id: "agence",
    label: "Agence (marketing, créa, digital)",
    matches: ["agence", "agence web", "agence digitale", "agence de communication", "studio créatif"],
    priorityDimensions: ["offer", "trust", "conversion"],
    trustSignals: ["portfolio de réalisations réelles", "méthode de travail explicite", "clients nommés"],
    channels: ["SEO", "recommandation", "réseaux sociaux", "publicité"],
    commonObjections: [
      "difficulté à différencier l'agence des concurrents",
      "crainte d'un engagement long sans résultat visible",
      "prix perçu comme opaque",
    ],
    conversionLevers: ["portfolio filtrable par secteur", "premier échange sans engagement", "grille tarifaire indicative"],
    typicalOpportunities: ["spécialiser le positionnement sur un secteur ou un type de résultat"],
    limits: "Un portfolio convaincant se juge sur la qualité réelle des réalisations, pas seulement leur présence.",
  },
  {
    id: "restaurant",
    label: "Restaurant / restauration",
    matches: ["restaurant", "restauration", "brasserie", "bistrot", "traiteur", "café", "pizzeria"],
    priorityDimensions: ["conversion", "trust", "acquisition"],
    trustSignals: ["photos réelles des plats/du lieu", "avis récents", "horaires et adresse à jour"],
    channels: ["Google Maps / recherche locale", "Instagram", "avis en ligne", "plateformes de réservation"],
    commonObjections: ["incertitude sur l'ambiance/le prix réel", "peur de ne pas avoir de table", "menu illisible"],
    conversionLevers: ["réservation en un clic", "menu à jour et lisible sur mobile", "avis récents visibles"],
    typicalOpportunities: ["remplacer un menu en PDF par une page de réservation directe"],
    limits: "La qualité de la cuisine elle-même n'est pas évaluable depuis le site.",
  },
  {
    id: "immobilier",
    label: "Immobilier (agence, mandataire)",
    matches: ["immobilier", "agence immobilière", "mandataire immobilier", "syndic", "gestion locative"],
    priorityDimensions: ["trust", "acquisition", "funnel"],
    trustSignals: ["mandats/biens réels affichés", "ancienneté de l'agence", "avis de clients vendeurs/acheteurs"],
    channels: ["portails d'annonces", "recherche locale", "recommandation", "réseaux sociaux"],
    commonObjections: ["doute sur la valeur ajoutée vs portail direct", "peur d'un mandat mal négocié"],
    conversionLevers: ["estimation gratuite en avant-plan", "captation de mandat clarifiée", "avis vendeurs visibles"],
    typicalOpportunities: ["rediriger chaque annonce vers une estimation plutôt qu'un simple contact"],
    limits: "Le volume réel de mandats et transactions n'est pas observable depuis le site public.",
  },
  {
    id: "artisan",
    label: "Artisan / métier manuel",
    matches: ["artisan", "plombier", "électricien", "menuisier", "maçon", "peintre en bâtiment", "couvreur", "paysagiste"],
    priorityDimensions: ["trust", "conversion", "acquisition"],
    trustSignals: ["réalisations photographiées", "zone d'intervention claire", "assurance/certification affichée"],
    channels: ["recherche locale", "bouche-à-oreille", "recommandation", "fiche Google Business"],
    commonObjections: ["peur de la malfaçon", "incertitude sur les délais et le prix", "disponibilité perçue"],
    conversionLevers: ["devis en ligne rapide", "galerie de chantiers classée par type", "délai de réponse affiché"],
    typicalOpportunities: ["qualifier le chantier avant le premier appel via un formulaire court"],
    limits: "Le bouche-à-oreille, canal souvent principal ici, n'est pas mesurable en ligne.",
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    matches: ["e-commerce", "ecommerce", "boutique en ligne", "vente en ligne", "shop"],
    priorityDimensions: ["conversion", "trust", "price_value"],
    trustSignals: ["politique de retour claire", "avis produits", "sécurité du paiement affichée"],
    channels: ["publicité", "SEO", "réseaux sociaux", "email", "marketplace"],
    commonObjections: ["incertitude sur la taille/qualité réelle", "coût de livraison surprise", "délai de retour flou"],
    conversionLevers: ["fiche produit avec preuve sociale", "frais annoncés tôt", "tunnel d'achat court"],
    typicalOpportunities: ["réduire le nombre d'étapes entre la fiche produit et le paiement"],
    limits: "Le taux de conversion et le panier moyen réels ne sont pas observables sans accès aux analytics du site.",
  },
  {
    id: "salle_de_sport",
    label: "Salle de sport / fitness",
    matches: ["salle de sport", "fitness", "coaching sportif", "crossfit", "box", "musculation"],
    priorityDimensions: ["conversion", "trust", "retention"],
    trustSignals: ["photos réelles des équipements/cours", "coachs nommés", "avis récents"],
    channels: ["recherche locale", "Instagram", "recommandation", "essai gratuit"],
    commonObjections: ["peur de l'engagement long", "intimidation perçue", "doute sur le résultat"],
    conversionLevers: ["séance d'essai réservable en ligne", "grille tarifaire claire", "témoignages avant/après vérifiables"],
    typicalOpportunities: ["remplacer un renvoi vers l'accueil par une réservation d'essai directe"],
    limits: "Le taux de rétention réel des adhérents n'est pas observable depuis le site public.",
  },
  {
    id: "beaute_esthetique",
    label: "Beauté / esthétique",
    matches: ["beauté", "institut de beauté", "esthétique", "spa", "onglerie", "coiffure", "barbier"],
    priorityDimensions: ["conversion", "acquisition", "trust"],
    trustSignals: ["photos réelles des réalisations", "avis récents", "hygiène/certifications affichées"],
    channels: ["Instagram", "TikTok", "recherche locale", "recommandation"],
    commonObjections: ["incertitude sur le résultat visuel", "disponibilité perçue", "prix non affiché"],
    conversionLevers: ["prise de rendez-vous en ligne instantanée", "galerie de réalisations récente"],
    typicalOpportunities: ["remplacer un renvoi vers les messages privés par un agenda en ligne"],
    limits: "La qualité réelle de la prestation ne se juge pas sur photos seules.",
  },
  {
    id: "formation",
    label: "Formation / éducation",
    matches: ["formation", "organisme de formation", "e-learning", "école", "bootcamp", "certification professionnelle"],
    priorityDimensions: ["trust", "offer", "conversion"],
    trustSignals: ["taux de réussite/débouchés si affichés", "certification reconnue", "témoignages d'anciens élèves"],
    channels: ["SEO", "publicité", "recommandation", "partenariats"],
    commonObjections: ["doute sur la reconnaissance du diplôme", "prix élevé perçu", "charge de travail incertaine"],
    conversionLevers: ["programme détaillé accessible", "financement/éligibilité clarifiés", "témoignages vérifiables"],
    typicalOpportunities: ["clarifier les débouchés concrets par formation"],
    limits: "Les taux de réussite ou d'insertion annoncés par l'organisme ne sont pas vérifiables depuis le site.",
  },
  {
    id: "services_locaux",
    label: "Services locaux (génériques)",
    matches: ["service local", "services", "entreprise locale", "entreprises locales", "pressing", "toilettage", "serrurier", "déménagement", "nettoyage", "jardinage"],
    priorityDimensions: ["conversion", "acquisition", "trust"],
    trustSignals: ["zone d'intervention claire", "avis récents", "disponibilité affichée"],
    channels: ["recherche locale", "fiche Google Business", "recommandation"],
    commonObjections: ["incertitude sur le prix avant contact", "délai de disponibilité", "confiance à l'entrée du domicile"],
    conversionLevers: ["devis rapide en ligne", "créneaux visibles", "avis récents visibles"],
    typicalOpportunities: ["afficher une fourchette de prix indicative pour réduire la friction du premier contact"],
    limits: "Catégorie généraliste : les critères précis varient beaucoup d'un métier à l'autre au sein du secteur.",
  },
  {
    id: "saas_logiciel",
    label: "SaaS / logiciel",
    matches: ["saas", "logiciel", "application web", "plateforme logicielle", "software"],
    priorityDimensions: ["conversion", "offer", "trust"],
    trustSignals: ["essai gratuit ou démo accessible", "clients/logos réels", "documentation produit"],
    channels: ["SEO", "content marketing", "publicité", "bouche-à-oreille produit"],
    commonObjections: [
      "doute sur l'intégration avec l'existant",
      "coût perçu vs alternative gratuite",
      "courbe d'apprentissage",
    ],
    conversionLevers: ["essai sans carte bancaire", "démonstration produit concrète", "tarification transparente"],
    typicalOpportunities: ["remplacer un formulaire de contact générique par un essai en libre-service"],
    limits: "Le taux d'activation ou de churn réel n'est pas observable depuis une page publique.",
  },
  {
    id: "avocat_reglemente",
    label: "Avocat / profession réglementée",
    matches: ["avocat", "notaire", "huissier", "expert-comptable", "commissaire de justice", "cabinet"],
    priorityDimensions: ["trust", "positioning", "conversion"],
    trustSignals: ["spécialisation(s) affichée(s)", "barreau/ordre d'appartenance", "identité claire des praticiens"],
    channels: ["recherche locale/spécialisée", "recommandation", "SEO juridique"],
    commonObjections: ["coût perçu comme opaque", "complexité du sujet", "urgence non prise en compte"],
    conversionLevers: ["premier échange cadré", "spécialisation nette", "coordonnées et disponibilité claires"],
    typicalOpportunities: ["clarifier les domaines de spécialisation plutôt qu'une liste générique de compétences"],
    limits:
      "Profession réglementée : certaines pratiques commerciales (démarchage, communication de résultats) sont encadrées et non évaluées ici.",
  },
  {
    id: "automobile",
    label: "Automobile (vente, garage, entretien)",
    matches: ["automobile", "garage", "concession", "carrosserie", "contrôle technique", "vente de véhicules"],
    priorityDimensions: ["trust", "conversion", "acquisition"],
    trustSignals: ["avis récents", "certifications/agréments affichés", "transparence sur les tarifs de base"],
    channels: ["recherche locale", "recommandation", "plateformes d'annonces auto"],
    commonObjections: ["peur d'être surfacturé", "doute sur l'état réel du véhicule/la fiabilité", "délai d'intervention"],
    conversionLevers: ["devis/rendez-vous en ligne", "tarifs de base affichés", "avis récents visibles"],
    typicalOpportunities: ["afficher un créneau de rendez-vous réservable plutôt qu'un simple numéro de téléphone"],
    limits: "L'état réel des véhicules ou la qualité des réparations ne sont pas observables depuis le site.",
  },
  {
    id: "autre",
    label: "Autre / secteur non reconnu",
    matches: [],
    priorityDimensions: ["positioning", "conversion", "trust"],
    trustSignals: ["identité claire de l'entreprise", "coordonnées vérifiables", "preuve sociale récente"],
    channels: ["recherche", "réseaux sociaux", "recommandation"],
    commonObjections: ["manque de clarté sur l'offre", "manque de preuve", "action suivante peu évidente"],
    conversionLevers: ["proposition de valeur claire", "action suivante unique et visible", "preuve de sérieux"],
    typicalOpportunities: ["clarifier l'offre et l'action attendue du visiteur"],
    limits:
      "Secteur non reconnu automatiquement : l'analyse s'appuie sur des critères de conversion généraux plutôt que sur des heuristiques spécifiques à votre métier.",
  },
];

export const AUTRE_PROFILE = SECTOR_PROFILES.find((p) => p.id === "autre")!;

export function getSectorProfile(id: (typeof SECTOR_PROFILES)[number]["id"]): SectorProfile {
  return SECTOR_PROFILES.find((p) => p.id === id) ?? AUTRE_PROFILE;
}

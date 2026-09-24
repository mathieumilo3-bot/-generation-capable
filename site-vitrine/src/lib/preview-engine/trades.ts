import { normalize } from "@/lib/audit-engine/crawl";

/**
 * Trade families. The quality bar is the same for every family — what
 * changes is the logic of the page: a roofer is chosen on visible work and
 * on the area covered, an electrician on qualifications, a landscaper almost
 * entirely on photos. Nothing here is a claim about a specific company; it
 * only decides ORDER and EMPHASIS. Every sentence the page shows still has to
 * come from the company's own facts.
 */

export type TradeFamilyId =
  | "plomberie_chauffage"
  | "couverture_charpente"
  | "maconnerie"
  | "electricite"
  | "menuiserie"
  | "peinture"
  | "carrelage"
  | "isolation"
  | "climatisation"
  | "paysagiste"
  | "renovation"
  | "entreprise_generale"
  | "restaurant"
  | "sante_bien_etre"
  | "ecommerce_marque"
  | "saas_logiciel"
  | "agence_b2b"
  | "immobilier"
  | "hotellerie"
  | "evenementiel"
  | "coaching_conseil"
  | "commerce_local"
  | "services_professionnels";

export type ProofKind = "portfolio" | "labels" | "reviews";
export type HeroVariant = "HeroEditorial" | "HeroProject" | "HeroLocal";
export type Motif = "roof" | "water" | "spark" | "leaf" | "stone" | "grain" | "stroke" | "tile" | "layers" | "air" | "frame";

export type TradeFamily = {
  id: TradeFamilyId;
  /** Neutral trade label used when the company's own wording is unknown. */
  label: string;
  /** Plural noun for the work, used in neutral headings ("Vos travaux de …"). */
  workNoun: string;
  /** Detection vocabulary (normalized, accent-free). */
  words: RegExp;
  /** NAF codes (prefix match) of the family. */
  naf: string[];
  /** Accent used only when no brand colour was observed. */
  accent: string;
  /** Preferred hero when a strong photo exists; otherwise the renderer falls back to HeroEditorial. */
  heroWithPhoto: HeroVariant;
  /** Which proof convinces first in this trade. */
  proofOrder: ProofKind[];
  motif: Motif;
};

export const TRADE_FAMILIES: Record<TradeFamilyId, TradeFamily> = {
  plomberie_chauffage: {
    id: "plomberie_chauffage",
    label: "Plombier chauffagiste",
    workNoun: "travaux de plomberie et de chauffage",
    words: /plomb|chauffag|chaudiere|sanitaire|salle de bain|pompe a chaleur|chauffe-eau|debouchage|canalisation/,
    naf: ["43.22A"],
    accent: "#1f4e79",
    heroWithPhoto: "HeroLocal",
    proofOrder: ["labels", "reviews", "portfolio"],
    motif: "water",
  },
  climatisation: {
    id: "climatisation",
    label: "Climatisation et pompes à chaleur",
    workNoun: "installations de climatisation",
    words: /climatis|pompe a chaleur|frigori|ventilation|vmc|froid/,
    naf: ["43.22B"],
    accent: "#2b6c8f",
    heroWithPhoto: "HeroLocal",
    proofOrder: ["labels", "reviews", "portfolio"],
    motif: "air",
  },
  couverture_charpente: {
    id: "couverture_charpente",
    label: "Couvreur charpentier",
    workNoun: "travaux de toiture",
    words: /couvreur|couverture|toiture|toit|charpent|zinguerie|goutti|demoussage|ardoise|tuile/,
    naf: ["43.91A", "43.91B"],
    accent: "#3d4b5c",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "labels", "reviews"],
    motif: "roof",
  },
  maconnerie: {
    id: "maconnerie",
    label: "Maçon",
    workNoun: "travaux de maçonnerie",
    words: /macon|gros oeuvre|beton|terrassement|dallage|fondation|mur|extension/,
    naf: ["43.99C", "43.99D", "43.11Z", "43.12A", "43.12B"],
    accent: "#6b5e4e",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "labels", "reviews"],
    motif: "stone",
  },
  electricite: {
    id: "electricite",
    label: "Électricien",
    workNoun: "travaux d’électricité",
    words: /electri|tableau|domotique|borne de recharge|irve|photovolta|eclairage|courant faible/,
    naf: ["43.21A", "43.21B"],
    accent: "#2e3f6e",
    heroWithPhoto: "HeroLocal",
    proofOrder: ["labels", "reviews", "portfolio"],
    motif: "spark",
  },
  menuiserie: {
    id: "menuiserie",
    label: "Menuisier",
    workNoun: "réalisations en menuiserie",
    words: /menuis|ebenist|fenetre|porte|volet|escalier|agencement|dressing|parquet|bois/,
    naf: ["43.32A", "43.32B", "43.32C", "16.23Z", "31.09B"],
    accent: "#6b4a2e",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "grain",
  },
  peinture: {
    id: "peinture",
    label: "Peintre en bâtiment",
    workNoun: "travaux de peinture",
    words: /peint|ravalement|facade|enduit|revetement mural|papier peint|decoration/,
    naf: ["43.34Z"],
    accent: "#8f4a36",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "stroke",
  },
  carrelage: {
    id: "carrelage",
    label: "Carreleur",
    workNoun: "travaux de carrelage",
    words: /carrel|faience|mosaique|revetement de sol|chape/,
    naf: ["43.33Z"],
    accent: "#2e6468",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "tile",
  },
  isolation: {
    id: "isolation",
    label: "Isolation",
    workNoun: "travaux d’isolation",
    words: /isolation|isolant|combles|ite\b|thermique|renovation energetique/,
    naf: ["43.29A"],
    accent: "#4a5d3f",
    heroWithPhoto: "HeroLocal",
    proofOrder: ["labels", "portfolio", "reviews"],
    motif: "layers",
  },
  paysagiste: {
    id: "paysagiste",
    label: "Paysagiste",
    workNoun: "aménagements extérieurs",
    words: /paysag|jardin|espaces verts|elagage|gazon|terrasse|arrosage|cloture|haie/,
    naf: ["81.30Z", "01.30Z"],
    accent: "#2f5d3a",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "leaf",
  },
  renovation: {
    id: "renovation",
    label: "Rénovation intérieure",
    workNoun: "travaux de rénovation",
    words: /renovation|platr|plaquiste|placo|cloison|faux plafond|finition|amenagement interieur/,
    naf: ["43.31Z", "43.39Z", "43.99A", "43.99B", "43.99E"],
    accent: "#3f3a36",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "frame",
  },
  restaurant: {
    id: "restaurant",
    label: "Restaurant",
    workNoun: "offre de restauration",
    words: /restaurant|brasserie|bistrot|pizzeria|traiteur|cuisine|menu|gastronom|snack|food/,
    naf: ["56.10", "56.21", "56.29"],
    accent: "#6f3f32",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "stroke",
  },
  sante_bien_etre: {
    id: "sante_bien_etre",
    label: "Santé et bien-être",
    workNoun: "prestations et rendez-vous",
    words: /clinique|cabinet|dent|medec|sante|kine|osteop|naturopath|therap|coiff|beaute|spa|massage|esthet/,
    naf: ["86.", "96.02", "96.04"],
    accent: "#315f63",
    heroWithPhoto: "HeroLocal",
    proofOrder: ["reviews", "labels", "portfolio"],
    motif: "air",
  },
  ecommerce_marque: {
    id: "ecommerce_marque",
    label: "Marque et e-commerce",
    workNoun: "produits",
    words: /e-?commerce|boutique en ligne|marque|collection|produit|shop|store|mode|vetement|cosmetique/,
    naf: ["47.91", "47.71", "47.75"],
    accent: "#34313b",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "frame",
  },
  saas_logiciel: {
    id: "saas_logiciel",
    label: "Logiciel / SaaS",
    workNoun: "solution logicielle",
    words: /saas|logiciel|software|plateforme|application|app\b|technologie|solution digitale/,
    naf: ["62.01", "62.02", "63.11"],
    accent: "#36536f",
    heroWithPhoto: "HeroEditorial",
    proofOrder: ["reviews", "portfolio", "labels"],
    motif: "layers",
  },
  agence_b2b: {
    id: "agence_b2b",
    label: "Agence / services B2B",
    workNoun: "services",
    words: /agence|marketing|communication|acquisition|studio|production|consulting|b2b|digital|web/,
    naf: ["70.21", "73.11", "74.10"],
    accent: "#343b55",
    heroWithPhoto: "HeroEditorial",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "frame",
  },
  immobilier: {
    id: "immobilier",
    label: "Immobilier",
    workNoun: "biens et services immobiliers",
    words: /immobilier|agence immobiliere|transaction|location|vente de biens|gestion locative|promoteur/,
    naf: ["68.31", "68.32", "68.10"],
    accent: "#4b514e",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "frame",
  },
  hotellerie: {
    id: "hotellerie",
    label: "Hôtel / hébergement",
    workNoun: "hébergements",
    words: /hotel|hôtel|hebergement|chambre|gite|gîte|maison d.hotes|resort|camping/,
    naf: ["55.10", "55.20", "55.30"],
    accent: "#5a493e",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "grain",
  },
  evenementiel: {
    id: "evenementiel",
    label: "Événementiel",
    workNoun: "événements et prestations",
    words: /evenement|événement|event|mariage|reception|reception|location de salle|dj|animation|scenographie/,
    naf: ["82.30", "90.02"],
    accent: "#5d3f64",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "spark",
  },
  coaching_conseil: {
    id: "coaching_conseil",
    label: "Conseil / coaching",
    workNoun: "accompagnements",
    words: /coach|coaching|consultant|conseil|formation|accompagnement|mentor|expertise/,
    naf: ["70.22", "85.59"],
    accent: "#4b4c55",
    heroWithPhoto: "HeroEditorial",
    proofOrder: ["reviews", "portfolio", "labels"],
    motif: "layers",
  },
  commerce_local: {
    id: "commerce_local",
    label: "Commerce",
    workNoun: "produits et services",
    words: /boutique|magasin|commerce|showroom|fleuriste|opticien|bijouter|epicerie|épicerie/,
    naf: ["47."],
    accent: "#5c463d",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "reviews", "labels"],
    motif: "tile",
  },
  services_professionnels: {
    id: "services_professionnels",
    label: "Services professionnels",
    workNoun: "services",
    words: /avocat|expert comptable|comptable|notaire|architecte|bureau d.etudes|assurance|courtier|recrutement|juridique/,
    naf: ["69.", "71.", "66.22", "78."],
    accent: "#36434d",
    heroWithPhoto: "HeroEditorial",
    proofOrder: ["reviews", "labels", "portfolio"],
    motif: "frame",
  },
  entreprise_generale: {
    id: "entreprise_generale",
    label: "Entreprise générale du bâtiment",
    workNoun: "chantiers",
    words: /entreprise generale|tous corps d.etat|btp|batiment|construction|clos couvert/,
    naf: ["41.20A", "41.20B", "41.10"],
    accent: "#2d3a45",
    heroWithPhoto: "HeroProject",
    proofOrder: ["portfolio", "labels", "reviews"],
    motif: "frame",
  },
};

export type TradeSignals = {
  /** Trade stated by the discovery step (e.g. "Couvreur / toiture"). */
  sector?: string;
  naf?: string;
  /** Service labels read on the site. */
  services?: string[];
  /** Domain, site title, company name: weak hints only. */
  hints?: string[];
};

/**
 * Picks the family with the most convergent evidence. NAF (official
 * registry) and the discovered sector weigh most; services confirm; names
 * and domains only break ties. Falls back to "entreprise_generale", the
 * most neutral page logic.
 */
export function detectTradeFamily(signals: TradeSignals): TradeFamilyId {
  const scores = new Map<TradeFamilyId, number>();
  const add = (id: TradeFamilyId, n: number) => scores.set(id, (scores.get(id) ?? 0) + n);
  const families = Object.values(TRADE_FAMILIES);

  if (signals.naf) {
    for (const family of families) if (family.naf.some((code) => signals.naf!.startsWith(code))) add(family.id, 6);
  }
  const sector = normalize(signals.sector ?? "");
  if (sector) for (const family of families) if (family.words.test(sector)) add(family.id, 5);
  for (const service of signals.services ?? []) {
    const text = normalize(service);
    for (const family of families) if (family.words.test(text)) add(family.id, 1);
  }
  const hints = normalize((signals.hints ?? []).join(" ")).replace(/[-_.]/g, " ");
  if (hints) for (const family of families) if (family.words.test(hints)) add(family.id, 2);

  let best: TradeFamilyId = "entreprise_generale";
  let bestScore = 0;
  for (const [id, score] of scores) {
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

/** Official NAF labels for the codes above: an OBSERVED description of the activity. */
export const NAF_LABELS: Record<string, string> = {
  "43.22A": "Travaux d’installation d’eau et de gaz",
  "43.22B": "Travaux d’installation d’équipements thermiques et de climatisation",
  "43.91A": "Travaux de charpente",
  "43.91B": "Travaux de couverture",
  "43.99C": "Travaux de maçonnerie générale et gros œuvre",
  "43.99D": "Autres travaux spécialisés de construction",
  "43.21A": "Travaux d’installation électrique",
  "43.32A": "Travaux de menuiserie bois et PVC",
  "43.32B": "Travaux de menuiserie métallique et serrurerie",
  "43.34Z": "Travaux de peinture et vitrerie",
  "43.33Z": "Travaux de revêtement des sols et des murs",
  "43.29A": "Travaux d’isolation",
  "81.30Z": "Services d’aménagement paysager",
  "43.31Z": "Travaux de plâtrerie",
  "43.39Z": "Autres travaux de finition",
  "41.20A": "Construction de maisons individuelles",
  "41.20B": "Construction d’autres bâtiments",
  "56.10A": "Restauration traditionnelle",
  "56.10C": "Restauration de type rapide",
  "56.21Z": "Services des traiteurs",
  "55.10Z": "Hôtels et hébergement similaire",
  "55.20Z": "Hébergement touristique et autre hébergement de courte durée",
  "62.01Z": "Programmation informatique",
  "62.02A": "Conseil en systèmes et logiciels informatiques",
  "68.31Z": "Agences immobilières",
  "68.32A": "Administration d’immeubles et autres biens immobiliers",
  "70.21Z": "Conseil en relations publiques et communication",
  "70.22Z": "Conseil pour les affaires et autres conseils de gestion",
  "73.11Z": "Activités des agences de publicité",
  "74.10Z": "Activités spécialisées de design",
  "82.30Z": "Organisation de foires, salons professionnels et congrès",
  "86.21Z": "Activité des médecins généralistes",
  "86.23Z": "Pratique dentaire",
  "96.02A": "Coiffure",
  "96.02B": "Soins de beauté",
};


export type BusinessUi = {
  offerNav: string;
  portfolioNav: string;
  locationNav: string;
  primaryShort: string;
  primaryCta: string;
  serviceEyebrow: string;
  serviceFallback: string;
  serviceAction: string;
  formAria: string;
  formTitle: string;
  formIntro: string;
  locationField: string;
  offerField: string;
  subheadline: string;
  finalHeading: string;
  finalBody: string;
  locationPrompt: string;
  showArea: boolean;
};

const DEFAULT_BUSINESS_UI: BusinessUi = {
  offerNav: "Prestations",
  portfolioNav: "Réalisations",
  locationNav: "Zone",
  primaryShort: "Devis",
  primaryCta: "Demander un devis",
  serviceEyebrow: "Prestations",
  serviceFallback: "Sur devis, selon votre projet.",
  serviceAction: "Demander un devis",
  formAria: "Formulaire de demande de devis (aperçu)",
  formTitle: "Votre projet",
  formIntro: "Quatre informations suffisent pour préparer votre devis.",
  locationField: "Ville du chantier",
  offerField: "Type de travaux",
  subheadline: "Décrivez votre projet et recevez votre devis.",
  finalHeading: "Un projet ? Parlons-en.",
  finalBody: "Décrivez votre besoin en quelques lignes : c’est le point de départ.",
  locationPrompt: "Indiquez l’adresse du chantier dans votre demande : nous vous confirmons si elle est dans notre secteur.",
  showArea: true,
};

const BUSINESS_UI: Partial<Record<TradeFamilyId, Partial<BusinessUi>>> = {
  restaurant: {
    offerNav: "Carte",
    portfolioNav: "Ambiance",
    locationNav: "Adresse",
    primaryShort: "Réserver",
    primaryCta: "Réserver une table",
    serviceEyebrow: "À la carte",
    serviceFallback: "Découvrez cette proposition.",
    serviceAction: "Réserver",
    formAria: "Formulaire de réservation (aperçu)",
    formTitle: "Votre réservation",
    formIntro: "Choisissez votre moment et laissez vos coordonnées.",
    locationField: "Date souhaitée",
    offerField: "Nombre de personnes",
    subheadline: "Découvrez l’univers du lieu et réservez simplement.",
    finalHeading: "Une table vous attend.",
    finalBody: "Choisissez votre moment et faites votre demande de réservation.",
    locationPrompt: "Retrouvez l’établissement et les informations utiles avant votre venue.",
  },
  sante_bien_etre: {
    primaryShort: "RDV",
    primaryCta: "Prendre rendez-vous",
    portfolioNav: "Le lieu",
    locationNav: "Cabinet",
    serviceAction: "Prendre rendez-vous",
    formAria: "Formulaire de prise de rendez-vous (aperçu)",
    formTitle: "Votre rendez-vous",
    formIntro: "Indiquez votre besoin et vos coordonnées.",
    locationField: "Ville",
    offerField: "Motif de rendez-vous",
    subheadline: "Comprenez les prestations et prenez rendez-vous simplement.",
    finalHeading: "Besoin d’un rendez-vous ?",
    finalBody: "Indiquez votre besoin et laissez vos coordonnées.",
  },
  ecommerce_marque: {
    offerNav: "Produits",
    portfolioNav: "Collection",
    locationNav: "Marque",
    primaryShort: "Découvrir",
    primaryCta: "Découvrir la collection",
    serviceEyebrow: "Produits",
    serviceFallback: "Découvrir ce produit.",
    serviceAction: "Découvrir",
    formAria: "Sélection produit (aperçu)",
    formTitle: "Trouvez votre produit",
    formIntro: "Parcourez la sélection et choisissez ce qui vous correspond.",
    locationField: "Votre besoin",
    offerField: "Produit recherché",
    subheadline: "Découvrez les produits, leurs usages et l’univers de la marque.",
    finalHeading: "Découvrez la collection.",
    finalBody: "Trouvez rapidement le produit qui correspond à votre besoin.",
    showArea: false,
  },
  saas_logiciel: {
    offerNav: "Fonctionnalités",
    portfolioNav: "Produit",
    locationNav: "Entreprise",
    primaryShort: "Démo",
    primaryCta: "Demander une démo",
    serviceEyebrow: "Fonctionnalités",
    serviceFallback: "Découvrez cette fonctionnalité.",
    serviceAction: "Voir la démo",
    formAria: "Formulaire de demande de démonstration (aperçu)",
    formTitle: "Votre besoin",
    formIntro: "Expliquez votre contexte pour préparer une démonstration utile.",
    locationField: "Entreprise",
    offerField: "Besoin principal",
    subheadline: "Comprenez la solution et voyez rapidement comment elle s’intègre à votre activité.",
    finalHeading: "Voyez le produit en situation.",
    finalBody: "Décrivez votre contexte et demandez une démonstration adaptée.",
    showArea: false,
  },
  agence_b2b: {
    offerNav: "Expertises",
    portfolioNav: "Projets",
    primaryShort: "Échanger",
    primaryCta: "Parler de votre projet",
    serviceEyebrow: "Expertises",
    serviceFallback: "Une approche adaptée à votre contexte.",
    serviceAction: "Parler du projet",
    formAria: "Formulaire de prise de contact (aperçu)",
    formTitle: "Votre projet",
    formIntro: "Expliquez le contexte, l’objectif et le besoin principal.",
    locationField: "Entreprise",
    offerField: "Besoin principal",
    subheadline: "Découvrez les expertises et ouvrez une discussion autour de votre objectif.",
    finalHeading: "Parlons de votre objectif.",
    finalBody: "Expliquez votre contexte en quelques lignes pour préparer un échange utile.",
    showArea: false,
  },
  immobilier: {
    offerNav: "Biens",
    portfolioNav: "Sélection",
    primaryShort: "Estimer",
    primaryCta: "Demander une estimation",
    serviceEyebrow: "Immobilier",
    serviceFallback: "Découvrez cette offre.",
    serviceAction: "En savoir plus",
    formAria: "Formulaire immobilier (aperçu)",
    formTitle: "Votre projet immobilier",
    formIntro: "Indiquez votre projet et vos coordonnées.",
    locationField: "Secteur recherché",
    offerField: "Acheter, vendre ou louer",
    subheadline: "Découvrez les biens et services adaptés à votre projet immobilier.",
    finalHeading: "Un projet immobilier ?",
    finalBody: "Décrivez votre besoin pour être recontacté avec les bonnes informations.",
  },
  hotellerie: {
    offerNav: "Séjours",
    portfolioNav: "Galerie",
    locationNav: "Lieu",
    primaryShort: "Réserver",
    primaryCta: "Voir les disponibilités",
    serviceEyebrow: "Séjours",
    serviceFallback: "Découvrez cette expérience.",
    serviceAction: "Voir les disponibilités",
    formAria: "Formulaire de réservation de séjour (aperçu)",
    formTitle: "Votre séjour",
    formIntro: "Indiquez vos dates et vos coordonnées.",
    locationField: "Dates souhaitées",
    offerField: "Type de séjour",
    subheadline: "Découvrez le lieu, les hébergements et préparez votre séjour.",
    finalHeading: "Préparez votre séjour.",
    finalBody: "Choisissez vos dates et consultez les disponibilités.",
  },
  evenementiel: {
    offerNav: "Prestations",
    portfolioNav: "Événements",
    primaryShort: "Projet",
    primaryCta: "Parler de votre événement",
    serviceEyebrow: "Prestations",
    serviceFallback: "Une prestation pensée selon votre événement.",
    serviceAction: "Parler de l’événement",
    formAria: "Formulaire événementiel (aperçu)",
    formTitle: "Votre événement",
    formIntro: "Indiquez le format, la date et votre besoin.",
    locationField: "Date / lieu",
    offerField: "Type d’événement",
    subheadline: "Découvrez les prestations et imaginez votre prochain événement.",
    finalHeading: "Un événement à préparer ?",
    finalBody: "Décrivez le format et le besoin pour préparer une proposition.",
  },
  coaching_conseil: {
    offerNav: "Accompagnements",
    portfolioNav: "Méthode",
    primaryShort: "Échanger",
    primaryCta: "Prendre un rendez-vous",
    serviceEyebrow: "Accompagnements",
    serviceFallback: "Un accompagnement adapté au besoin.",
    serviceAction: "Prendre rendez-vous",
    formAria: "Formulaire de prise de rendez-vous (aperçu)",
    formTitle: "Votre objectif",
    formIntro: "Expliquez votre situation et l’objectif recherché.",
    locationField: "Situation actuelle",
    offerField: "Objectif principal",
    subheadline: "Découvrez l’approche et choisissez l’accompagnement adapté à votre objectif.",
    finalHeading: "Parlons de votre objectif.",
    finalBody: "Décrivez votre situation et préparez un premier échange.",
    showArea: false,
  },
  commerce_local: {
    offerNav: "Produits",
    portfolioNav: "Boutique",
    locationNav: "Adresse",
    primaryShort: "Découvrir",
    primaryCta: "Découvrir l’offre",
    serviceEyebrow: "En boutique",
    serviceFallback: "Découvrez cette offre.",
    serviceAction: "En savoir plus",
    formAria: "Formulaire de contact boutique (aperçu)",
    formTitle: "Votre recherche",
    formIntro: "Indiquez ce que vous cherchez et vos coordonnées.",
    locationField: "Ville",
    offerField: "Produit ou besoin",
    subheadline: "Découvrez l’offre et les informations utiles avant votre visite.",
    finalHeading: "Vous cherchez quelque chose en particulier ?",
    finalBody: "Indiquez votre besoin pour obtenir la bonne information rapidement.",
  },
  services_professionnels: {
    offerNav: "Expertises",
    portfolioNav: "Références",
    primaryShort: "Contact",
    primaryCta: "Prendre contact",
    serviceEyebrow: "Expertises",
    serviceFallback: "Une expertise adaptée à votre situation.",
    serviceAction: "Prendre contact",
    formAria: "Formulaire de prise de contact (aperçu)",
    formTitle: "Votre besoin",
    formIntro: "Présentez brièvement votre situation et vos coordonnées.",
    locationField: "Entreprise / ville",
    offerField: "Sujet principal",
    subheadline: "Identifiez l’expertise adaptée et prenez contact simplement.",
    finalHeading: "Expliquez votre besoin.",
    finalBody: "Quelques lignes suffisent pour préparer un premier échange.",
    showArea: false,
  },
};

export function getBusinessUi(id: TradeFamilyId): BusinessUi {
  return { ...DEFAULT_BUSINESS_UI, ...(BUSINESS_UI[id] ?? {}) };
}

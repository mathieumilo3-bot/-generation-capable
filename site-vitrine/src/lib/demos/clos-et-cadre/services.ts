/**
 * Services are written as answers to a prospect's situation, not as a list of
 * trades: for whom, in which situation, for what result, what the company
 * takes charge of — and which delivered projects prove it.
 */

export type ServiceId = "extension" | "surelevation" | "renovation-globale" | "restructuration";

export type Service = {
  id: ServiceId;
  name: string;
  promise: string;
  forWhom: string;
  situations: string[];
  outcome: string;
  weHandle: string[];
  goodToKnow: string;
  typicalBudget: string;
  typicalDuration: string;
  /** Slugs of projects that illustrate this service, most relevant first. */
  projects: string[];
};

export const SERVICES: Service[] = [
  {
    id: "extension",
    name: "Extension de maison",
    promise: "Gagner une pièce de vie sans quitter une maison que l'on aime.",
    forWhom:
      "Familles propriétaires d'une maison ancienne dont le rez-de-chaussée est devenu trop petit ou mal relié au jardin.",
    situations: [
      "La cuisine est fermée et tourne le dos au jardin",
      "Une véranda existante est devenue inutilisable",
      "Il manque une chambre ou un bureau au rez-de-chaussée",
    ],
    outcome:
      "Une extension qui se raccorde à l'existant comme si elle avait toujours été là : mêmes niveaux de sol, ouverture structurelle maîtrisée, isolation au niveau du neuf.",
    weHandle: [
      "Étude de faisabilité et lecture du PLU de votre commune",
      "Plans et autorisation d'urbanisme, avec notre architecte partenaire quand elle est obligatoire",
      "Bureau d'études structure pour toute ouverture de mur porteur",
      "Fondations, ossature, couverture, menuiseries et second œuvre",
      "Raccordement à l'existant : sols, réseaux, chauffage",
    ],
    goodToKnow:
      "Au-delà de 20 m² créés (40 m² en zone urbaine d'un PLU), un permis de construire est nécessaire. Si la surface totale dépasse 150 m² après travaux, le recours à un architecte est obligatoire : nous l'intégrons au projet.",
    typicalBudget: "À partir de 90 000 € HT",
    typicalDuration: "4 à 6 mois, études comprises",
    projects: ["extension-maison-meuliere-chatou"],
  },
  {
    id: "surelevation",
    name: "Surélévation",
    promise: "Construire un étage quand le terrain ne permet plus de s'étendre.",
    forWhom:
      "Propriétaires de pavillons de plain-pied ou à combles perdus, sur des parcelles où l'emprise au sol est déjà atteinte.",
    situations: [
      "La parcelle est trop petite pour une extension au sol",
      "La famille s'agrandit et il manque des chambres",
      "Les combles existants ne sont pas aménageables",
    ],
    outcome:
      "Un étage complet, construit en ossature bois préfabriquée pour réduire au minimum le temps pendant lequel la maison est ouverte.",
    weHandle: [
      "Étude géotechnique et diagnostic des fondations avant toute surcharge",
      "Permis de construire et vérification du gabarit autorisé",
      "Préfabrication en atelier et mise hors d'eau en quelques jours",
      "Escalier, trémie et raccordements entre les deux niveaux",
    ],
    goodToKnow:
      "Toute surélévation commence par la vérification des fondations. Si elles ne permettent pas la surcharge, nous vous le disons avant de chiffrer le reste.",
    typicalBudget: "À partir de 150 000 € HT",
    typicalDuration: "5 à 7 mois, études comprises",
    projects: ["surelevation-pavillon-rueil-malmaison"],
  },
  {
    id: "renovation-globale",
    name: "Rénovation globale",
    promise: "Reprendre une maison entière, en un seul chantier coordonné.",
    forWhom:
      "Acquéreurs d'une maison à rénover, ou propriétaires qui veulent traiter en une fois l'isolation, les installations et le plan.",
    situations: [
      "Vous venez d'acheter une maison qui n'a pas été rénovée depuis sa construction",
      "La maison est froide l'hiver et chère à chauffer",
      "Les installations électriques et de plomberie sont d'origine",
    ],
    outcome:
      "Une maison remise à niveau du sol à la toiture, avec un seul interlocuteur, un seul planning et une date de livraison tenue.",
    weHandle: [
      "Relevé complet et diagnostic de l'existant",
      "Isolation, menuiseries, chauffage et ventilation pensés ensemble",
      "Redistribution des pièces et reprise de tous les réseaux",
      "Coordination de tous les corps d'état jusqu'à la réception",
    ],
    goodToKnow:
      "Une rénovation globale peut ouvrir droit à des aides à la rénovation énergétique, sous conditions et avec une entreprise qualifiée : nous vérifions votre situation au moment de l'étude.",
    typicalBudget: "À partir de 150 000 € HT",
    typicalDuration: "6 à 9 mois de chantier",
    projects: ["renovation-globale-pavillon-le-vesinet"],
  },
  {
    id: "restructuration",
    name: "Restructuration et murs porteurs",
    promise: "Changer le plan d'un logement sans toucher à ses murs extérieurs.",
    forWhom:
      "Propriétaires de maisons et de grands appartements dont les pièces sont fermées, sombres ou mal distribuées.",
    situations: [
      "Vous voulez réunir cuisine et séjour",
      "Un couloir occupe une surface que vous ne vivez pas",
      "Vous êtes en copropriété et le mur à ouvrir est porteur",
    ],
    outcome:
      "Un plan ouvert, une structure recalculée et justifiée, et un dossier technique que votre copropriété ou votre assureur peut lire.",
    weHandle: [
      "Note de calcul par un bureau d'études structure",
      "Dossier technique pour l'assemblée générale et suivi avec le syndic",
      "Étaiement, ouverture et pose de la poutre",
      "Redistribution des cloisons, réseaux et finitions",
    ],
    goodToKnow:
      "En copropriété, ouvrir un mur porteur suppose l'autorisation de l'assemblée générale. Nous préparons le dossier technique qui lui est présenté.",
    typicalBudget: "À partir de 60 000 € HT",
    typicalDuration: "3 à 5 mois de chantier",
    projects: [
      "restructuration-appartement-saint-germain-en-laye",
      "extension-maison-meuliere-chatou",
    ],
  },
];

export function getService(id: ServiceId): Service {
  const service = SERVICES.find((candidate) => candidate.id === id);
  if (!service) throw new Error(`Unknown service: ${id}`);
  return service;
}

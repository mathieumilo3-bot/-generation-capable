import type { ServiceId } from "./services";

/**
 * Worked-example projects for the Clos & Cadre demonstration. The structure is
 * what matters: it is the sheet a real construction company would fill for
 * each delivered job, so a prospect can recognise their own situation
 * (type of house, constraint, budget bracket) rather than just a nice photo.
 *
 * Budgets, surfaces and durations are plausible orders of magnitude for the
 * Paris western suburbs, chosen to illustrate the format. They are demo
 * content and are presented only inside the labelled demonstration.
 */

export type SceneId = "meuliere" | "pavillon" | "appartement" | "surelevation";

export type Project = {
  slug: string;
  title: string;
  shortTitle: string;
  commune: string;
  service: ServiceId;
  scene: SceneId;
  /** One line a prospect reads on a card: the situation, not the adjective. */
  situation: string;
  facts: {
    building: string;
    surface: string;
    duration: string;
    budget: string;
    occupancy: string;
    authorisation: string;
  };
  problem: string;
  constraints: string[];
  solution: string;
  technical: { label: string; value: string }[];
  result: string;
  beforeAfter: { before: string; intervention: string; after: string };
  lots: string[];
};

export const PROJECTS: Project[] = [
  {
    slug: "extension-maison-meuliere-chatou",
    title: "Une extension ossature bois qui ouvre une maison en meulière sur son jardin",
    shortTitle: "Extension d'une maison en meulière",
    commune: "Chatou",
    service: "extension",
    scene: "meuliere",
    situation:
      "Maison de 1928, cuisine fermée et véranda vieillissante : la famille voulait vivre côté jardin sans déménager.",
    facts: {
      building: "Maison en meulière, 1928",
      surface: "38 m² créés — 156 m² après travaux",
      duration: "5 mois, dont 14 semaines de chantier",
      budget: "180 000 – 220 000 € HT",
      occupancy: "Maison habitée pendant les travaux",
      authorisation: "Permis de construire (surface totale > 150 m²)",
    },
    problem:
      "La cuisine, isolée à l'arrière de la maison, tournait le dos au jardin. Une véranda des années 1990 prenait l'eau et rendait la pièce inutilisable l'hiver comme l'été. Le mur de façade arrière, en meulière de 45 cm, est porteur.",
    constraints: [
      "Surface totale après travaux supérieure à 150 m² : recours à un architecte obligatoire",
      "Mur arrière porteur en meulière à ouvrir sur 4,20 m",
      "Accès chantier par un passage latéral de 1,10 m",
      "Famille de quatre restée dans la maison",
    ],
    solution:
      "Démolition de la véranda, extension en ossature bois posée sur fondations neuves, bardage mélèze à claire-voie et baie coulissante de 4,80 m. Le mur arrière est ouvert sous une poutre acier dimensionnée par le bureau d'études, pour faire de la cuisine et de l'extension une seule pièce de vie tournée vers le jardin.",
    technical: [
      { label: "Fondations", value: "Semelles filantes béton armé, plancher bas sur vide sanitaire" },
      { label: "Structure", value: "Ossature bois 45 × 220, contreventement OSB, isolation 220 mm" },
      { label: "Ouverture", value: "Poutre HEB 240 sur deux poteaux, étaiement et reprise en sous-œuvre" },
      { label: "Toiture", value: "Toiture plate, membrane EPDM, isolant 240 mm, acrotère zinc" },
      { label: "Menuiseries", value: "Coulissant aluminium 4,80 m, rupture de pont thermique" },
      { label: "Façade", value: "Bardage mélèze à claire-voie, pare-pluie noir" },
    ],
    result:
      "Une pièce de vie de 62 m² qui traverse la maison jusqu'au jardin. La chambre du rez-de-chaussée est conservée ; la façade sur rue n'a pas été touchée.",
    beforeAfter: {
      before: "Véranda aluminium de 1994 sur dalle fissurée, cuisine fermée derrière un mur porteur.",
      intervention: "Démolition, fondations, ouverture du mur sous poutre acier, extension ossature bois.",
      after: "Une seule pièce de vie ouverte sur le jardin, baie de 4,80 m, toiture isolée.",
    },
    lots: ["Démolition", "Gros œuvre", "Structure", "Ossature bois", "Couverture", "Menuiseries", "Électricité", "Plâtrerie", "Revêtements"],
  },
  {
    slug: "renovation-globale-pavillon-le-vesinet",
    title: "La rénovation complète d'un pavillon des années 1970, de l'isolation au plan",
    shortTitle: "Rénovation globale d'un pavillon",
    commune: "Le Vésinet",
    service: "renovation-globale",
    scene: "pavillon",
    situation:
      "Pavillon de 1972 acheté pour être entièrement repensé : froid l'hiver, cloisonné, installations d'origine.",
    facts: {
      building: "Pavillon, 1972",
      surface: "165 m² rénovés",
      duration: "7 mois de chantier",
      budget: "280 000 – 340 000 € HT",
      occupancy: "Maison inoccupée pendant les travaux",
      authorisation: "Déclaration préalable (modification de façade)",
    },
    problem:
      "Aucune isolation des murs, simple vitrage d'origine, chauffage au fioul et électricité hors normes. Le plan distribuait six petites pièces au rez-de-chaussée, avec une pièce de vie sombre au nord.",
    constraints: [
      "Travaux à terminer avant l'emménagement, date contractuelle",
      "Architecte des Bâtiments de France consulté : secteur protégé",
      "Coordination de neuf corps d'état sur une maison vidée",
    ],
    solution:
      "Isolation thermique par l'extérieur, remplacement de toutes les menuiseries, pompe à chaleur air/eau et ventilation double flux. À l'intérieur, redistribution complète du rez-de-chaussée et création d'une grande ouverture au sud.",
    technical: [
      { label: "Enveloppe", value: "ITE fibre de bois 160 mm, enduit chaux teinté" },
      { label: "Menuiseries", value: "Bois-aluminium, double vitrage à isolation renforcée" },
      { label: "Chauffage", value: "Pompe à chaleur air/eau, plancher chauffant au rez-de-chaussée" },
      { label: "Ventilation", value: "VMC double flux, réseau en faux plafond" },
      { label: "Électricité", value: "Installation neuve, tableau et attestation de conformité" },
      { label: "Toiture", value: "Isolation des combles perdus 400 mm, reprise des zingueries" },
    ],
    result:
      "Une maison au plan ouvert, lumineuse au sud, livrée à la date prévue. La performance énergétique après travaux est à documenter par le diagnostic réalisé à la livraison.",
    beforeAfter: {
      before: "Façade crépie d'origine, petites fenêtres, toiture tuiles sans isolation.",
      intervention: "Isolation par l'extérieur, nouvelles ouvertures, menuiseries et toiture reprises.",
      after: "Façade enduite à la chaux, baies agrandies au sud, maison isolée du sol à la toiture.",
    },
    lots: ["Démolition", "Maçonnerie", "Isolation", "Façade", "Menuiseries", "Plomberie", "Chauffage", "Électricité", "Plâtrerie", "Revêtements"],
  },
  {
    slug: "restructuration-appartement-saint-germain-en-laye",
    title: "Un appartement ancien restructuré autour d'un mur porteur ouvert",
    shortTitle: "Restructuration d'un appartement",
    commune: "Saint-Germain-en-Laye",
    service: "restructuration",
    scene: "appartement",
    situation:
      "Appartement de 112 m² en copropriété : couloir interminable, cuisine isolée, séjour sans lumière traversante.",
    facts: {
      building: "Immeuble 1890, 4e étage avec ascenseur",
      surface: "112 m²",
      duration: "4 mois de chantier",
      budget: "140 000 – 170 000 € HT",
      occupancy: "Appartement inoccupé",
      authorisation: "Accord de l'assemblée générale de copropriété",
    },
    problem:
      "Un plan en enfilade, typique des immeubles de la fin du XIXe siècle : un couloir de 11 mètres desservait des pièces fermées, la cuisine donnait sur cour et le séjour ne recevait la lumière que d'un côté.",
    constraints: [
      "Mur de refend porteur : note de calcul et accord de la copropriété",
      "Planchers bois anciens à conserver et à renforcer",
      "Horaires de chantier et protection des parties communes imposés par le syndic",
    ],
    solution:
      "Ouverture du mur de refend sous poutre métallique pour relier cuisine et séjour, suppression du couloir au profit d'une entrée ouvrant sur la pièce de vie, et regroupement des chambres côté cour, au calme.",
    technical: [
      { label: "Structure", value: "Poutre acier sur appuis maçonnés, note de calcul du bureau d'études" },
      { label: "Planchers", value: "Renforcement des solives, parquet chêne d'origine restauré" },
      { label: "Démarches", value: "Dossier technique présenté en AG, suivi avec le syndic" },
      { label: "Acoustique", value: "Chape désolidarisée dans les pièces d'eau" },
      { label: "Réseaux", value: "Plomberie et électricité refaites, gaines techniques créées" },
    ],
    result:
      "Une pièce de vie traversante de 48 m², trois chambres côté cour et deux salles d'eau. Les moulures et le parquet d'origine ont été conservés.",
    beforeAfter: {
      before: "Couloir de 11 m, cuisine fermée sur cour, séjour mono-orienté.",
      intervention: "Ouverture du refend sous poutre acier, redistribution des cloisons.",
      after: "Pièce de vie traversante rue-cour, chambres regroupées au calme.",
    },
    lots: ["Démolition", "Structure", "Plâtrerie", "Menuiserie intérieure", "Plomberie", "Électricité", "Parquets", "Peinture"],
  },
  {
    slug: "surelevation-pavillon-rueil-malmaison",
    title: "Un étage de plus sur un pavillon, sans toucher à son jardin",
    shortTitle: "Surélévation d'un pavillon",
    commune: "Rueil-Malmaison",
    service: "surelevation",
    scene: "surelevation",
    situation:
      "Pavillon de plain-pied sur une petite parcelle : impossible de s'étendre au sol, la famille a gagné un étage.",
    facts: {
      building: "Pavillon de plain-pied, 1958",
      surface: "52 m² créés à l'étage",
      duration: "6 mois, dont 3 semaines hors d'eau",
      budget: "210 000 – 260 000 € HT",
      occupancy: "Famille relogée 6 semaines, puis retour",
      authorisation: "Permis de construire",
    },
    problem:
      "Une parcelle de 310 m² dont le coefficient d'emprise au sol était atteint : aucune extension possible au sol. Il fallait deux chambres et une salle de bains supplémentaires.",
    constraints: [
      "Fondations existantes à vérifier avant toute surcharge",
      "Maison découverte pendant la dépose de la toiture : phase critique à maîtriser",
      "Hauteur maximale fixée par le PLU",
    ],
    solution:
      "Étude de sol et diagnostic des fondations, puis surélévation en ossature bois, légère, préfabriquée en atelier et montée en quatre jours pour limiter le temps de maison ouverte. Un nouvel escalier relie les deux niveaux.",
    technical: [
      { label: "Diagnostic", value: "Étude géotechnique et sondages des fondations existantes" },
      { label: "Structure", value: "Chaînage béton, murs à ossature bois préfabriqués" },
      { label: "Mise hors d'eau", value: "Montage et bâchage en 4 jours, couverture en 3 semaines" },
      { label: "Couverture", value: "Zinc à joint debout, isolation 300 mm" },
      { label: "Circulation", value: "Escalier chêne sur mesure, trémie créée dans le plancher" },
    ],
    result:
      "Deux chambres, une salle de bains et un palier bureau à l'étage. Le jardin est intact et la maison a gardé son implantation d'origine.",
    beforeAfter: {
      before: "Pavillon de plain-pied, toiture tuiles à deux pans, combles non aménageables.",
      intervention: "Dépose de la toiture, chaînage, surélévation ossature bois préfabriquée.",
      after: "Un étage complet sous toiture zinc, dans le gabarit autorisé par le PLU.",
    },
    lots: ["Diagnostic", "Gros œuvre", "Ossature bois", "Couverture zinc", "Menuiseries", "Plomberie", "Électricité", "Plâtrerie", "Escalier"],
  },
];

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((project) => project.slug === slug);
}

export function projectsForService(service: ServiceId): Project[] {
  return PROJECTS.filter((project) => project.service === service);
}

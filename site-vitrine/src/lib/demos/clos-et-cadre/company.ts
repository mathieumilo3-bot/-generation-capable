/**
 * Clos & Cadre is a FICTIONAL company: a strategic and design concept by
 * Génération Capable, built to show a construction business what its site
 * could do. It is not a client and has no real address, phone or history.
 *
 * Two rules follow from that, and every file in this folder respects them:
 *
 * 1. Anything a real company would have to prove — founding year, headcount,
 *    insurer, certifications, reviews, testimonials, press, partners — is
 *    NEVER filled in with an invented value. It is a `ToFill` slot that the
 *    site renders as a visible "à compléter" marker.
 * 2. The positioning, services and projects are a worked example of how the
 *    site would present such a company. The whole demo is labelled as a
 *    demonstration (ribbon + footer), it is `noindex`, and it carries no
 *    LocalBusiness structured data, so it can never be mistaken for a real
 *    business by a visitor or a search engine.
 */

/** A value the real company has to provide. Rendered as a marker, never guessed. */
export type ToFill = { toFill: string };

export const toFill = (label: string): ToFill => ({ toFill: label });

export function isToFill(value: unknown): value is ToFill {
  return typeof value === "object" && value !== null && "toFill" in value;
}

export const DEMO_BASE_PATH = "/demonstrations/clos-et-cadre";
export const CASE_STUDY_PATH = "/etudes-de-cas/clos-et-cadre";

export const COMPANY = {
  name: "Clos & Cadre",
  legalLine: "Rénovation globale, extensions et surélévations",
  baseline: "Entreprise générale de rénovation — Ouest parisien",
  /**
   * Numbers reserved by ARCEP for fiction and audiovisual works (01 99 00 xx xx):
   * they can never ring a real subscriber.
   */
  phoneDisplay: "01 99 00 27 40",
  phoneHref: "tel:+33199002740",
  email: "projets@clos-et-cadre.example",
  hours: "Du lundi au vendredi, 8 h – 18 h 30",
  visitsNote: "Visites de chantier et rendez-vous sur place, y compris le samedi matin sur demande.",
  address: toFill("Adresse du siège et du dépôt"),
  founded: toFill("Année de création"),
  team: toFill("Effectif salarié (dont compagnons)"),
  deliveredProjects: toFill("Nombre de chantiers livrés, vérifiable"),
  googleProfile: toFill("Lien vers la fiche Google Business Profile"),
  siren: toFill("SIREN / RCS"),
} as const;

/**
 * The strategic brief the whole design follows from (section 2 of the GC
 * construction standard). Displayed in the case study, and the reason each
 * section of the demo exists.
 */
export const BRIEF = {
  trade:
    "Entreprise générale de rénovation : elle pilote tous les corps d'état d'un chantier, avec ses propres équipes pour le gros œuvre, la structure et les menuiseries, et des partenaires réguliers pour les lots techniques.",
  specialties: [
    "Extensions de maisons (ossature bois ou maçonnerie)",
    "Surélévations de pavillons",
    "Rénovation globale de maisons anciennes, énergétique comprise",
    "Restructuration intérieure et ouverture de murs porteurs",
  ],
  projectSize:
    "De 80 000 € à 350 000 € HT par chantier. En dessous de 40 000 €, l'entreprise oriente vers des artisans spécialisés.",
  area:
    "Yvelines et Hauts-de-Seine, dans un rayon d'environ 25 km autour de la boucle de la Seine : Chatou, Le Vésinet, Croissy, Saint-Germain-en-Laye, Rueil-Malmaison, Versailles, Saint-Cloud…",
  idealClient:
    "Propriétaires d'une maison ancienne (meulière, pavillon des années 1930 à 1970) ou d'un grand appartement, souvent une famille, qui préfèrent transformer leur bien plutôt que déménager, et dont le projet représente l'un des plus gros investissements de leur vie.",
  mostProfitable:
    "Rénovations globales et extensions avec réaménagement de l'existant : un seul chantier coordonné, plusieurs lots, un volume qui justifie une préparation sérieuse.",
  differentiators: [
    "Un conducteur de travaux unique, du relevé à la levée des réserves",
    "Un devis décomposé lot par lot, avec planning et échéancier liés à l'avancement",
    "Des équipes salariées sur les lots qui conditionnent la solidité de l'ouvrage",
    "Un point hebdomadaire avec photos, même quand le client ne peut pas venir",
  ],
  hesitations: [
    "« Le budget va dériver. »",
    "« Le chantier va durer deux fois plus longtemps que prévu. »",
    "« Est-ce qu'ils ont déjà fait un projet comme le mien ? »",
    "« Qui s'occupe du permis, de l'architecte, du bureau d'études ? »",
    "« On ne pourra pas vivre dans la maison pendant les travaux. »",
    "« Et si l'entreprise disparaît au milieu du chantier ? »",
  ],
  proofsNeeded: [
    "Des réalisations comparables, documentées, pas seulement photographiées",
    "L'attestation d'assurance décennale et son périmètre",
    "Des avis vérifiables et des témoignages rattachés à un chantier précis",
    "Une méthode lisible : qui fait quoi, quand, et comment on est informé",
    "Une implantation locale réelle : adresse, zone, chantiers voisins",
  ],
  beforeCallback: [
    "Type de projet et nature du bien",
    "Commune — pour vérifier la zone et le PLU",
    "Époque de construction et surfaces",
    "Démarches déjà engagées (plans, architecte, autorisation)",
    "Horizon de démarrage et enveloppe envisagée",
    "Photos de l'existant",
    "Meilleur moment pour rappeler",
  ],
} as const;

export type Commune = { name: string; department: "78" | "92" };

/** Communes served — used by the zone map, the project filters and the form. */
export const COMMUNES: Commune[] = [
  { name: "Chatou", department: "78" },
  { name: "Le Vésinet", department: "78" },
  { name: "Croissy-sur-Seine", department: "78" },
  { name: "Le Pecq", department: "78" },
  { name: "Saint-Germain-en-Laye", department: "78" },
  { name: "Marly-le-Roi", department: "78" },
  { name: "Louveciennes", department: "78" },
  { name: "Bougival", department: "78" },
  { name: "Versailles", department: "78" },
  { name: "Maisons-Laffitte", department: "78" },
  { name: "Rueil-Malmaison", department: "92" },
  { name: "Saint-Cloud", department: "92" },
  { name: "Garches", department: "92" },
  { name: "Vaucresson", department: "92" },
  { name: "Suresnes", department: "92" },
];

export const COMMUNE_NAMES = COMMUNES.map((commune) => commune.name);

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
  | "entreprise_generale";

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
};

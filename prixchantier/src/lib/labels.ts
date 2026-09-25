export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "outline";

export const PROJECT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  preparation: { label: "Préparation", tone: "neutral" },
  consultation: { label: "Consultation", tone: "info" },
  reponses_en_cours: { label: "Réponses en cours", tone: "warning" },
  comparatif_pret: { label: "Comparatif prêt", tone: "success" },
  termine: { label: "Terminé", tone: "outline" },
};

export const CONSULTATION_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  a_envoyer: { label: "À envoyer", tone: "neutral" },
  envoye: { label: "Envoyé", tone: "info" },
  relance_prevue: { label: "Relance prévue", tone: "info" },
  relance: { label: "Relancé", tone: "warning" },
  repondu: { label: "Répondu", tone: "success" },
  reponse_partielle: { label: "Réponse partielle", tone: "warning" },
  refus: { label: "Refus", tone: "outline" },
  erreur: { label: "Erreur", tone: "danger" },
  annulee: { label: "Annulée", tone: "outline" },
};

export const RESPONSE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  needs_assignment: { label: "À rattacher", tone: "warning" },
  pending: { label: "Analyse en attente", tone: "info" },
  processing: { label: "Analyse en cours", tone: "info" },
  processed: { label: "Analysée", tone: "success" },
  failed: { label: "Échec d'analyse", tone: "danger" },
};

export const CLASSIFICATION: Record<string, string> = {
  offer: "Offre",
  partial: "Offre partielle",
  refusal: "Refus",
  other: "Sans offre chiffrée",
};

export const MATCH_METHOD: Record<string, string> = {
  thread: "fil de discussion",
  header: "en-têtes du mail",
  reference: "référence dans l'objet",
  sender: "adresse de l'expéditeur",
  manual: "import manuel",
};

export const DOC_KIND: Record<string, string> = { dpgf: "DPGF / quantitatif", cctp: "CCTP", other: "Autre document" };

export const AWAITING = new Set(["envoye", "relance_prevue", "relance"]);
export const RESPONDED = new Set(["repondu", "reponse_partielle", "refus"]);

/** Devine le type d'un document à partir de son nom et de son format. */
export function guessDocKind(name: string): "dpgf" | "cctp" | "other" {
  const n = name.toLowerCase();
  if (/cctp|descriptif|cahier des clauses/.test(n)) return "cctp";
  if (/dpgf|dqe|bpu|quantitatif|bordereau|metre|métré/.test(n)) return "dpgf";
  if (/\.(xlsx|xls|csv)$/.test(n)) return "dpgf";
  return "other";
}

/** Familles d'achat proposées (classement IA et saisie manuelle). */
export const CATEGORIES = [
  "Production chaud/froid",
  "Émetteurs",
  "Ventilation / CTA",
  "Réseaux aérauliques",
  "Tuyauterie / réseaux",
  "Robinetterie / vannes",
  "Pompes / circulateurs",
  "Régulation / GTB",
  "Calorifuge / isolation",
  "Production ECS",
  "Appareils sanitaires",
  "Évacuations",
  "Distribution électrique",
  "Câbles / conduits",
  "Appareillage / éclairage",
  "Courants faibles",
  "Sécurité incendie",
  "Main d'œuvre / prestations",
  "Études / essais / DOE",
  "Divers",
] as const;

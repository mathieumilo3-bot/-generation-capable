/**
 * Use cases, not client work. Nothing here describes a real engagement, a
 * real result or a real customer — each card says what a system of this kind
 * is built to do. The wording on screen labels them as applications.
 */
export type Application = {
  id: string;
  code: string;
  name: string;
  forWhom: string;
  problem: string;
  system: string;
  signals: string[];
};

export const APPLICATIONS: Application[] = [
  {
    id: "local",
    code: "01",
    name: "LOCAL",
    forWhom: "Commerces, restaurants, instituts",
    problem:
      "La visibilité locale est éclatée entre fiches, avis et réseaux, sans point central qui convertit.",
    system:
      "Une présence unique qui absorbe tous les canaux et mène à une réservation ou un appel.",
    signals: ["Réservation directe", "Visibilité locale", "Avis centralisés"],
  },
  {
    id: "service",
    code: "02",
    name: "SERVICE",
    forWhom: "Artisans, prestataires, entreprises de services",
    problem:
      "Les demandes arrivent mal qualifiées et font perdre du temps avant même le premier échange.",
    system:
      "Un parcours de devis qui qualifie le besoin avant qu'il n'atteigne votre téléphone.",
    signals: ["Devis qualifiés", "Preuve du savoir-faire", "Moins d'allers-retours"],
  },
  {
    id: "expert",
    code: "03",
    name: "EXPERT",
    forWhom: "Cabinets, consultants, professions réglementées",
    problem:
      "La crédibilité se joue avant le premier contact, et le site ne la porte pas.",
    system:
      "Une présence sobre qui installe l'autorité, puis filtre les demandes avant l'agenda.",
    signals: ["Autorité", "Prise de rendez-vous", "Qualification en amont"],
  },
  {
    id: "growth",
    code: "04",
    name: "GROWTH",
    forWhom: "Entreprises qui ont déjà du trafic",
    problem:
      "L'audience existe, mais le parcours perd les visiteurs avant l'action.",
    system:
      "Mesure, correction des points de fuite, et itérations sur ce qui convertit réellement.",
    signals: ["Tracking", "Optimisation continue", "Points de fuite traités"],
  },
];

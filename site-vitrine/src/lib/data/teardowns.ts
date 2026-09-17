/**
 * Illustrative concept reconstructions — not real client work and not tied
 * to any named, identifiable business. Used to demonstrate the kind of
 * transformation Génération Capable produces, honestly labeled as such.
 */
export type Teardown = {
  id: string;
  sectorLabel: string;
  before: { label: string; points: string[] };
  after: { label: string; points: string[] };
  why: string[];
};

export const TEARDOWNS: Teardown[] = [
  {
    id: "cabinet-conseil",
    sectorLabel: "Concept — cabinet de conseil (exemple fictif)",
    before: {
      label: "AVANT",
      points: [
        "Page d'accueil qui liste sept prestations avant d'expliquer un seul problème client",
        "Formulaire de contact générique en bas de page, sans qualification",
        "Aucune action claire dans les dix premières secondes de visite",
      ],
    },
    after: {
      label: "APRÈS",
      points: [
        "Un seul message d'entrée, centré sur le problème le plus fréquent des clients du cabinet",
        "Prise de rendez-vous en trois questions, directement sous le premier écran",
        "Preuve de méthode (process en étapes) plutôt qu'une liste de compétences",
      ],
    },
    why: [
      "Un visiteur ne compare pas des listes de prestations, il cherche à savoir si on comprend son problème.",
      "Réduire le nombre de choix affichés augmente la probabilité qu'une action soit prise.",
      "Qualifier avant le rendez-vous protège le temps du cabinet et améliore la qualité des échanges.",
    ],
  },
];

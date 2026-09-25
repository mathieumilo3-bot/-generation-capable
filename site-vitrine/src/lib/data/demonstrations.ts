/**
 * Génération Capable's demonstrations: complete sites built for a FICTIONAL
 * company of a given sector, to show a prospect in that sector what the work
 * looks like. They are concepts, never presented as client work — every entry
 * carries the "Concept stratégique et design" credit on screen.
 */
export type Demonstration = {
  slug: string;
  company: string;
  sector: string;
  summary: string;
  demoPath: string;
  caseStudyPath: string;
};

export const DEMONSTRATIONS: Demonstration[] = [
  {
    slug: "clos-et-cadre",
    company: "Clos & Cadre",
    sector: "Construction et rénovation",
    summary:
      "Le site d'une entreprise générale de rénovation de l'Ouest parisien : un portfolio de chantiers documentés, des services reliés à leurs preuves, et un pré-diagnostic qui remet à l'entreprise une fiche projet priorisée.",
    demoPath: "/demonstrations/clos-et-cadre",
    caseStudyPath: "/etudes-de-cas/clos-et-cadre",
  },
];

export const CONCEPT_CREDIT = "Concept stratégique et design — Génération Capable";

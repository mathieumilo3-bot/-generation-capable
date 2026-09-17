/**
 * No fabricated clients, results, or testimonials. Génération Capable is
 * early-stage: this collection stays empty (or real, once cases exist) by
 * design — see the "Premières transformations" empty state on /cas-clients.
 */
export type CaseStudy = {
  slug: string;
  client: string;
  sector: string;
  context: string;
  problem: string;
  intervention: string;
  system: string;
  results: string;
  testimonial?: string;
};

export const CASE_STUDIES: CaseStudy[] = [];

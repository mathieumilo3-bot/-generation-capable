export type System = {
  id: string;
  code: string;
  name: string;
  headline: string;
  description: string;
  capabilities: string[];
};

export const SYSTEMS: System[] = [
  {
    id: "presence",
    code: "SYSTEM 01",
    name: "PRESENCE",
    headline: "L'actif digital qui porte votre crédibilité.",
    description:
      "Un site n'est pas une brochure. C'est l'endroit où se joue la première impression, et la première objection.",
    capabilities: ["Site premium", "Identité digitale", "Architecture", "Expérience"],
  },
  {
    id: "acquisition",
    code: "SYSTEM 02",
    name: "ACQUISITION",
    headline: "Faire venir la bonne attention, au bon endroit.",
    description:
      "La visibilité ne vaut que si elle amène les bonnes personnes, au bon moment de leur décision.",
    capabilities: ["SEO", "Contenu", "Réseaux", "Acquisition digitale"],
  },
  {
    id: "conversion",
    code: "SYSTEM 03",
    name: "CONVERSION",
    headline: "Transformer l'attention en prise de contact.",
    description:
      "Entre la visite et la décision, il y a un parcours. Chaque friction dans ce parcours coûte une opportunité.",
    capabilities: ["Landing pages", "Funnels", "Qualification", "Prise de rendez-vous"],
  },
  {
    id: "growth",
    code: "SYSTEM 04",
    name: "GROWTH",
    headline: "Faire évoluer le système avec les résultats.",
    description:
      "Un système digital n'est jamais figé. Il se mesure, s'ajuste, et s'améliore avec la donnée réelle.",
    capabilities: ["Optimisation", "Tracking", "Stratégie", "Accompagnement"],
  },
];

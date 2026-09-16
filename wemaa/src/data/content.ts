/**
 * Contenu éditorial du site — modifiable sans toucher aux composants.
 */

export const brand = {
  name: "Wemaa Services",
  tagline: "Événements • Coordination • Excellence",
};

export const nav = [
  { label: "Accueil", href: "/#accueil" },
  { label: "Nos expertises", href: "/#expertises" },
  { label: "Nos réalisations", href: "/#realisations" },
  { label: "À propos", href: "/#apropos" },
  { label: "Contact", href: "/#contact" },
];

export const hero = {
  label: "Wemaa Services",
  titleLine1: "Créons ensemble des événements",
  titleHighlight: "inoubliables.",
  subtitle:
    "Wemaa Services, votre partenaire de confiance pour l'organisation, la coordination et la mise en place de vos événements privés et professionnels.",
  cta: "Planifier mon événement",
  reassurance: [
    "Une équipe expérimentée",
    "Un accompagnement sur mesure",
    "Des événements qui marquent",
  ],
};

export type ServiceItem = {
  id: string;
  title: string;
  description: string;
  imageKey: "serviceMariages" | "serviceProfessionnels" | "serviceCoordination" | "servicePersonnel";
};

export const services: ServiceItem[] = [
  {
    id: "mariages",
    title: "Mariages",
    description: "Des instants uniques, une organisation parfaite.",
    imageKey: "serviceMariages",
  },
  {
    id: "evenements-professionnels",
    title: "Événements professionnels",
    description: "Séminaires, galas, lancements de produits, soirées d'entreprise.",
    imageKey: "serviceProfessionnels",
  },
  {
    id: "coordination-organisation",
    title: "Coordination & organisation",
    description: "De la conception à la réalisation, nous vous accompagnons à chaque étape.",
    imageKey: "serviceCoordination",
  },
  {
    id: "personnel-evenementiel",
    title: "Personnel événementiel",
    description: "Des équipes qualifiées pour un service irréprochable, du début à la fin.",
    imageKey: "servicePersonnel",
  },
];

export const servicesSection = {
  title: "Une offre complète pour chaque moment important.",
};

export const about = {
  title: "Plus qu'un événement,\nune expérience.",
  paragraphs: [
    "Wemaa Services est une agence spécialisée dans la création et la coordination d'événements sur mesure.",
    "Avec une équipe expérimentée et passionnée, nous mettons tout en œuvre pour transformer vos idées en moments inoubliables.",
  ],
  cta: "Notre histoire",
};

export type Stat = {
  value: string;
  label: string;
};

// Valeurs facilement modifiables — à ajuster avec les chiffres réels de Wemaa Services.
export const stats: Stat[] = [
  { value: "5+", label: "Années d'expérience" },
  { value: "300+", label: "Événements réalisés" },
  { value: "100%", label: "Clients satisfaits" },
  { value: "24/7", label: "Équipe à votre écoute" },
];

export const portfolioSection = {
  title: "Des événements qui parlent d'eux-mêmes.",
  cta: "Voir toutes nos réalisations",
};

export type Testimonial = {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
};

// Témoignages FICTIFS — placeholders à remplacer par de vrais avis clients avant mise en ligne.
export const testimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Camille R.",
    role: "Mariage — témoignage fictif, à remplacer",
    quote:
      "Une organisation d'une fluidité incroyable. Chaque détail avait été pensé, nous n'avons eu qu'à profiter de notre journée.",
    rating: 5,
  },
  {
    id: "t2",
    name: "Julien M.",
    role: "Séminaire d'entreprise — témoignage fictif, à remplacer",
    quote:
      "Une équipe professionnelle et réactive du premier échange jusqu'au jour J. Nos invités ont été bluffés par la qualité de la mise en place.",
    rating: 5,
  },
  {
    id: "t3",
    name: "Sarah B.",
    role: "Réception privée — témoignage fictif, à remplacer",
    quote:
      "Wemaa Services a su comprendre exactement ce que nous voulions et l'a sublimé. Un vrai accompagnement sur mesure, de bout en bout.",
    rating: 5,
  },
];

export const testimonialsSection = {
  eyebrow: "Ils nous font confiance",
  title: "Leur satisfaction est notre plus belle réussite.",
  disclaimer: "Témoignages fictifs à titre d'exemple — à remplacer par de vrais avis clients.",
};

export const ctaFinal = {
  title: "Prêt à donner vie à votre projet ?",
  subtitle: "Parlons ensemble de votre événement et créons quelque chose d'exceptionnel.",
  cta: "Demander un devis",
};

export const quotePage = {
  title: "Parlons de votre événement",
  subtitle:
    "Remplissez ce formulaire en quelques secondes et notre équipe vous recontactera rapidement pour discuter de votre projet.",
  submitLabel: "Envoyer ma demande",
  perks: [
    {
      title: "Réponse rapide",
      detail: "Sous 24 à 48h",
    },
    {
      title: "Devis personnalisé",
      detail: "Selon vos besoins",
    },
    {
      title: "Conseil offert",
      detail: "Sans engagement",
    },
  ],
  eventTypes: [
    "Mariage",
    "Événement professionnel",
    "Coordination / Organisation",
    "Personnel événementiel",
    "Autre",
  ],
  budgets: [
    "Moins de 5 000 €",
    "5 000 € – 15 000 €",
    "15 000 € – 30 000 €",
    "30 000 € – 50 000 €",
    "Plus de 50 000 €",
    "À définir ensemble",
  ],
};

export const contact = {
  phone: "+33 1 23 45 67 89",
  email: "contact@wemaaservices.fr",
  location: "Paris, France",
  socials: [
    { label: "Instagram", href: "https://instagram.com" },
    { label: "TikTok", href: "https://tiktok.com" },
    { label: "LinkedIn", href: "https://linkedin.com" },
  ],
};

export const footer = {
  columns: [
    {
      title: "Nos expertises",
      links: [
        { label: "Mariages", href: "/#expertises" },
        { label: "Événements professionnels", href: "/#expertises" },
        { label: "Coordination & organisation", href: "/#expertises" },
        { label: "Personnel événementiel", href: "/#expertises" },
      ],
    },
    {
      title: "Réalisations",
      links: [{ label: "Voir la galerie", href: "/realisations" }],
    },
    {
      title: "À propos",
      links: [{ label: "Notre histoire", href: "/#apropos" }],
    },
    {
      title: "Contact",
      links: [{ label: "Demander un devis", href: "/devis" }],
    },
  ],
  legal: [
    { label: "Mentions légales", href: "#" },
    { label: "Politique de confidentialité", href: "#" },
  ],
};

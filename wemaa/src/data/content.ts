/**
 * Contenu éditorial du site — modifiable sans toucher aux composants.
 */

export const brand = {
  name: "Wemaa Services",
  tagline: "Création & coordination d'événements",
};

export const nav = [
  { label: "Accueil", href: "/#accueil" },
  { label: "Nos expertises", href: "/#expertises" },
  { label: "Nos réalisations", href: "/#realisations" },
  { label: "À propos", href: "/#apropos" },
  { label: "Contact", href: "/devis" },
];

export const hero = {
  label: "Wemaa Services",
  title: "Création & coordination d'événements d'exception",
  subtitle:
    "Mariages, événements professionnels, coordination, personnel événementiel... Nous donnons vie à vos plus beaux projets.",
  cta: "Planifier mon événement",
  reassurance: [
    { icon: "ear", label: "Écoute & conseil personnalisé" },
    { icon: "team", label: "Une équipe expérimentée" },
    { icon: "check", label: "Une organisation sans faille" },
    { icon: "heart", label: "Des souvenirs inoubliables" },
  ],
};

export type ServiceItem = {
  id: string;
  title: string;
  description: string;
  icon: "heart" | "briefcase" | "check" | "team";
  imageKey: "serviceMariages" | "serviceProfessionnels" | "serviceCoordination" | "servicePersonnel";
};

export const services: ServiceItem[] = [
  {
    id: "mariages",
    title: "Mariages",
    description: "Un jour unique, une organisation parfaite.",
    icon: "heart",
    imageKey: "serviceMariages",
  },
  {
    id: "evenements-professionnels",
    title: "Événements professionnels",
    description: "Séminaires, galas, lancements...",
    icon: "briefcase",
    imageKey: "serviceProfessionnels",
  },
  {
    id: "coordination-organisation",
    title: "Coordination d'événements",
    description: "De l'idée à la réalisation, on s'occupe de tout.",
    icon: "check",
    imageKey: "serviceCoordination",
  },
  {
    id: "personnel-evenementiel",
    title: "Personnel événementiel",
    description: "Des équipes qualifiées, pour un service irréprochable.",
    icon: "team",
    imageKey: "servicePersonnel",
  },
];

export const servicesSection = {
  eyebrow: "Nos expertises",
  title: "Des services sur mesure pour chaque occasion",
  subtitle:
    "Que vous soyez un particulier ou une entreprise, nous vous accompagnons à chaque étape de votre événement avec professionnalisme et créativité.",
};

export const team = {
  eyebrow: "À propos",
  title: "Une équipe passionnée,\nà votre service",
  paragraphs: [
    "Chez Wemaa Services, nous croyons que chaque détail compte. Notre équipe met tout en œuvre pour faire de votre événement un moment unique et inoubliable.",
  ],
  cta: "Découvrir notre équipe",
};

export type Stat = {
  value: string;
  label: string;
};

// Valeurs facilement modifiables — à ajuster avec les chiffres réels de Wemaa Services.
export const statsSection = {
  title: "Wemaa Services en quelques chiffres",
};

export const stats: Stat[] = [
  { value: "100+", label: "Événements réalisés" },
  { value: "5", label: "Années d'expérience" },
  { value: "95%", label: "Clients satisfaits" },
  { value: "1", label: "Équipe passionnée" },
];

export const portfolioSection = {
  eyebrow: "Nos réalisations",
  title: "Chaque événement est une histoire unique",
  subtitle: "Découvrez un aperçu de nos dernières réalisations et laissez-vous inspirer.",
  cta: "Voir toutes nos réalisations",
};

export type Testimonial = {
  id: string;
  name: string;
  quote: string;
  rating: number;
};

// Témoignages FICTIFS — placeholders à remplacer par de vrais avis clients avant mise en ligne.
export const testimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Aminata & Moussa",
    quote:
      "Une équipe au top ! Notre mariage a été au-delà de nos attentes. Tout était parfait, du début à la fin.",
    rating: 5,
  },
  {
    id: "t2",
    name: "Sophie L.",
    quote:
      "Professionnalisme, écoute et disponibilité. Notre événement d'entreprise a été un vrai succès. Merci encore !",
    rating: 5,
  },
  {
    id: "t3",
    name: "Karim B.",
    quote:
      "Une organisation impeccable, une équipe souriante et très professionnelle. Je recommande Wemaa Services les yeux fermés.",
    rating: 5,
  },
];

export const testimonialsSection = {
  eyebrow: "Ils nous font confiance",
  title: "Leur satisfaction, notre plus belle récompense",
  disclaimer: "Témoignages fictifs à titre d'exemple — à remplacer par de vrais avis clients.",
};

export type ProcessStep = {
  number: string;
  title: string;
  description: string;
};

export const processSection = {
  title: "Le processus est simple",
  steps: [
    { number: "1", title: "Votre demande", description: "Remplissez le formulaire" },
    { number: "2", title: "Échange", description: "Nous discutons de votre projet" },
    { number: "3", title: "Proposition", description: "Vous recevez un devis sur mesure" },
    { number: "4", title: "L'événement", description: "On s'occupe du reste !" },
  ] as ProcessStep[],
};

export const ctaFinal = {
  title: "Prêt à créer un événement inoubliable ?",
  subtitle: "Parlons ensemble de votre événement et créons quelque chose d'exceptionnel.",
  cta: "Demander un devis",
};

export const ctaMid = {
  title: "Votre événement mérite l'excellence",
  subtitle: "Wemaa Services, plus qu'un prestataire, un partenaire de confiance.",
  cta: "Demander un devis",
};

export const quotePage = {
  eyebrow: "Contact",
  title: "Parlons de votre événement",
  subtitle:
    "Remplissez ce formulaire en quelques secondes et notre équipe vous recontactera rapidement pour discuter de votre projet.",
  submitLabel: "Envoyer ma demande",
  perks: [
    { icon: "lock", label: "Vos données sont sécurisées" },
    { icon: "clock", label: "Réponse sous 24h" },
    { icon: "chat", label: "Sans engagement" },
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
  phone: "+33 6 12 34 56 78",
  email: "contact@wemaaservices.fr",
  location: "Paris, France",
  socials: [
    { label: "Instagram", href: "https://instagram.com" },
    { label: "Facebook", href: "https://facebook.com" },
    { label: "TikTok", href: "https://tiktok.com" },
    { label: "WhatsApp", href: "https://wa.me/33612345678" },
  ],
};

export const footer = {
  tagline: "Création & coordination d'événements",
  columns: [
    {
      title: "Nos expertises",
      links: [
        { label: "Mariages", href: "/#expertises" },
        { label: "Événements professionnels", href: "/#expertises" },
        { label: "Coordination d'événements", href: "/#expertises" },
        { label: "Personnel événementiel", href: "/#expertises" },
      ],
    },
    {
      title: "Liens utiles",
      links: [
        { label: "À propos", href: "/#apropos" },
        { label: "Nos réalisations", href: "/realisations" },
        { label: "Contact", href: "/devis" },
        { label: "Mentions légales", href: "#" },
      ],
    },
  ],
  bottomNote: "Créé avec ♥ pour vos plus beaux événements",
};

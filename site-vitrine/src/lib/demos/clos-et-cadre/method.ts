/**
 * The process, written so a visitor knows exactly what happens after they
 * click — who calls, what is measured, what they receive, what they sign.
 */
export type Step = {
  number: string;
  title: string;
  duration: string;
  what: string;
  youGet: string;
};

export const STEPS: Step[] = [
  {
    number: "01",
    title: "Premier échange",
    duration: "Sous 2 jours ouvrés",
    what:
      "Le conducteur de travaux qui suivra votre chantier vous rappelle au créneau que vous avez choisi. Il a déjà lu votre demande et vos photos : l'appel sert à comprendre votre projet, pas à vous faire répéter le formulaire.",
    youGet: "Un premier avis sur la faisabilité et la suite à donner.",
  },
  {
    number: "02",
    title: "Étude du projet",
    duration: "1 semaine",
    what:
      "Lecture du PLU de votre commune, du cadastre et des plans existants. Nous identifions l'autorisation nécessaire, le besoin d'un architecte ou d'un bureau d'études, et les points qui peuvent faire varier le budget.",
    youGet: "La liste des démarches et des points à vérifier sur place.",
  },
  {
    number: "03",
    title: "Visite et relevé",
    duration: "1 h 30 sur place",
    what:
      "Relevé des cotes, sondage des murs et planchers concernés, repérage de l'accès chantier et des réseaux. C'est là que se décident les choix techniques qui tiendront le budget.",
    youGet: "Un relevé de l'existant, conservé dans votre dossier.",
  },
  {
    number: "04",
    title: "Proposition détaillée",
    duration: "2 à 3 semaines",
    what:
      "Un devis décomposé lot par lot, avec les quantités, les matériaux et les marques. Il est accompagné d'un planning prévisionnel et d'un échéancier de paiement calé sur l'avancement réel du chantier.",
    youGet: "Un prix lisible, poste par poste, que vous pouvez comparer.",
  },
  {
    number: "05",
    title: "Préparation du chantier",
    duration: "Selon l'autorisation",
    what:
      "Dépôt de l'autorisation d'urbanisme, études de structure, commandes des matériaux à long délai, information du voisinage et de la copropriété, installation du chantier.",
    youGet: "Une date de démarrage ferme et le planning contractuel.",
  },
  {
    number: "06",
    title: "Réalisation",
    duration: "Selon le projet",
    what:
      "Un seul interlocuteur du premier au dernier jour. Chaque semaine, un point d'avancement avec photos, décisions à prendre et prochaines étapes, que vous soyez sur place ou non.",
    youGet: "Un compte rendu hebdomadaire écrit et photographié.",
  },
  {
    number: "07",
    title: "Livraison et suivi",
    duration: "1 an et au-delà",
    what:
      "Réception contradictoire des travaux, levée des éventuelles réserves dans les délais convenus, remise du dossier des ouvrages exécutés. La garantie de parfait achèvement court un an ; la garantie décennale, dix ans.",
    youGet: "Le dossier complet de votre ouvrage et un contact qui reste le même.",
  },
];

export type Faq = { question: string; answer: string };

/** The objections from the brief, answered in the company's own terms. */
export const FAQ: Faq[] = [
  {
    question: "Comment éviter que le budget dérive ?",
    answer:
      "En décidant les choix techniques avant de signer, pas pendant le chantier. Le relevé et les sondages de l'étape 3 servent à ça. Si un imprévu apparaît malgré tout — une poutre pourrie derrière un doublage, par exemple — vous recevez un avenant chiffré et vous validez avant que nous ne l'exécutions.",
  },
  {
    question: "Qui s'occupe du permis, de l'architecte, du bureau d'études ?",
    answer:
      "Nous. Nous vérifions l'autorisation nécessaire dès l'étude du projet, travaillons avec un architecte partenaire lorsqu'il est obligatoire et faisons calculer toute intervention sur la structure par un bureau d'études. Vous signez les documents ; nous les préparons et les déposons.",
  },
  {
    question: "Peut-on rester dans la maison pendant les travaux ?",
    answer:
      "Souvent, pour une extension : le chantier est isolé de la partie habitée et l'ouverture du mur se fait en fin de parcours, en quelques jours. Pour une rénovation globale ou une surélévation, un relogement de quelques semaines est généralement nécessaire. Nous vous le disons dès la visite.",
  },
  {
    question: "Comment sont organisés les paiements ?",
    answer:
      "Un acompte à la signature, puis des situations de travaux liées à l'avancement réel : vous ne payez jamais une étape qui n'est pas réalisée. Le solde est réglé à la réception.",
  },
  {
    question: "Quelles garanties couvrent mon chantier ?",
    answer:
      "La garantie de parfait achèvement pendant un an, la garantie de bon fonctionnement des équipements pendant deux ans et la garantie décennale pendant dix ans. Notre attestation d'assurance décennale est remise avec le devis ; nous vous conseillons aussi sur l'assurance dommages-ouvrage.",
  },
  {
    question: "Intervenez-vous pour des petits travaux ?",
    answer:
      "Nos équipes sont organisées pour des chantiers à partir d'environ 40 000 € HT. En dessous, nous préférons vous orienter vers un artisan spécialisé plutôt que de vous faire attendre.",
  },
];

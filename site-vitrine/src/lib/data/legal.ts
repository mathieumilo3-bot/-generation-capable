/**
 * The single place to fill in the legal identity of the company.
 *
 * Every value below was explicitly provided by the site's owner, never
 * invented — including the contact email, chosen and confirmed for public
 * display on /mentions-legales and /politique-de-confidentialite.
 */
export type LegalEntity = {
  denomination: string;
  formeJuridique: string;
  capital: string;
  siege: string;
  siren: string;
  rcs: string;
  tvaIntracommunautaire: string;
  directeurPublication: string;
  email: string;
  telephone: string;
};

export const LEGAL_ENTITY: LegalEntity = {
  denomination: "LE DORVEN ENZO",
  formeJuridique: "Entrepreneur individuel",
  capital: "",
  siege: "2 rue Anita Conti, 56300 Pontivy, France",
  siren: "981 319 957",
  rcs: "",
  tvaIntracommunautaire: "",
  directeurPublication: "Enzo Le Dorven",
  email: "ledorvenenzo50@gmail.com",
  telephone: "",
};

export const HOST = {
  nom: "Netlify, Inc.",
  adresse: "2325 3rd Street, Suite 296, San Francisco, CA 94107, États-Unis",
  site: "https://www.netlify.com",
};

export const SUBPROCESSORS = [
  {
    nom: "Resend",
    role: "Acheminement des emails de notification du diagnostic et, uniquement après opt-in dédié, gestion des contacts destinés aux communications marketing.",
    pays: "États-Unis",
    site: "https://resend.com/legal/dpa",
  },
  {
    nom: "Supabase",
    role: "Stockage des demandes de notification du diagnostic, des coordonnées fournies volontairement et du statut de l’analyse.",
    pays: "Union européenne",
    site: "https://supabase.com/privacy",
  },
  {
    nom: HOST.nom,
    role: "Hébergement du site et journaux techniques du serveur.",
    pays: "États-Unis",
    site: "https://www.netlify.com/gdpr-ccpa/",
  },
  {
    nom: "Calendly",
    role: "Prise de rendez-vous. Le nom et l'email peuvent être préremplis uniquement lorsque l'utilisateur choisit d'ouvrir la réservation.",
    pays: "États-Unis",
    site: "https://calendly.com/legal",
  },
  {
    nom: "OpenAI",
    role: "Synthèse facultative du diagnostic Capable Audit à partir de signaux publics du site, du secteur déclaré et de l'objectif. Les coordonnées du formulaire (nom, email, téléphone) ne sont pas envoyées à ce service.",
    pays: "États-Unis",
    site: "https://openai.com/policies/privacy-policy/",
  },
];

const REQUIRED: (keyof LegalEntity)[] = [
  "denomination",
  "formeJuridique",
  "siege",
  "siren",
  "directeurPublication",
  "email",
];

export function isLegalEntityComplete(entity: LegalEntity = LEGAL_ENTITY): boolean {
  return REQUIRED.every((field) => entity[field].trim().length > 0);
}

export function missingLegalFields(entity: LegalEntity = LEGAL_ENTITY): string[] {
  return REQUIRED.filter((field) => entity[field].trim().length === 0);
}

export function legalRows(entity: LegalEntity = LEGAL_ENTITY): { label: string; value: string }[] {
  return [
    { label: "Dénomination sociale", value: entity.denomination },
    { label: "Forme juridique", value: entity.formeJuridique },
    { label: "Capital social", value: entity.capital },
    { label: "Siège social", value: entity.siege },
    { label: "SIREN / SIRET", value: entity.siren },
    { label: "RCS", value: entity.rcs },
    { label: "TVA intracommunautaire", value: entity.tvaIntracommunautaire },
    { label: "Directeur de la publication", value: entity.directeurPublication },
    { label: "Email", value: entity.email },
    { label: "Téléphone", value: entity.telephone },
  ].filter((row) => row.value.trim().length > 0);
}

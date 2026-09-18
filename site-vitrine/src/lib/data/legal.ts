/**
 * The single place to fill in the legal identity of the company.
 *
 * Nothing here is invented: every field ships empty and the legal pages
 * degrade honestly until it is filled. Fill it once, redeploy, and
 * /mentions-legales and /politique-de-confidentialite become complete and
 * publishable — which French law (LCEN art. 6-III) and the Google Ads and
 * Meta advertising policies all require before running paid traffic.
 */
export type LegalEntity = {
  /** Dénomination sociale, e.g. "Génération Capable SAS". */
  denomination: string;
  /** Forme juridique : SAS, SARL, EI, micro-entreprise… */
  formeJuridique: string;
  /** Capital social, e.g. "1 000 €". Laisser vide pour une entreprise individuelle. */
  capital: string;
  /** Adresse complète du siège social. */
  siege: string;
  /** Numéro SIREN ou SIRET. */
  siren: string;
  /** Ville du greffe, e.g. "RCS Paris 900 000 000". Vide si non immatriculé au RCS. */
  rcs: string;
  /** Numéro de TVA intracommunautaire. Vide si non assujetti. */
  tvaIntracommunautaire: string;
  /** Nom du directeur de la publication. */
  directeurPublication: string;
  /** Email de contact publié. */
  email: string;
  /** Téléphone publié. Optionnel. */
  telephone: string;
};

export const LEGAL_ENTITY: LegalEntity = {
  denomination: "",
  formeJuridique: "",
  capital: "",
  siege: "",
  siren: "",
  rcs: "",
  tvaIntracommunautaire: "",
  directeurPublication: "",
  email: "",
  telephone: "",
};

/**
 * The host the site is actually deployed on. The registered address changes
 * from time to time: copy the current one from https://www.netlify.com/legal/
 * rather than trusting a value hard-coded here.
 */
export const HOST = {
  nom: "Netlify, Inc.",
  adresse: "",
  site: "https://www.netlify.com",
};

/** The sub-processors that actually receive personal data today. */
export const SUBPROCESSORS = [
  {
    nom: "Resend",
    role: "Acheminement des emails de notification du formulaire Capable Audit.",
    pays: "États-Unis",
    site: "https://resend.com/legal/dpa",
  },
  {
    nom: HOST.nom,
    role: "Hébergement du site et journaux techniques du serveur.",
    pays: "États-Unis",
    site: "https://www.netlify.com/gdpr-ccpa/",
  },
];

/** Champs sans lesquels les mentions légales ne sont pas conformes. */
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

/** Les lignes à afficher, dans l'ordre, en sautant celles qui ne s'appliquent pas. */
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

import { COMMUNE_NAMES } from "./company";

/**
 * The qualified project request — the "pré-diagnostic commercial" of the demo.
 *
 * Shared by the client form (validation step by step) and the API route
 * (validation of the whole payload, then qualification). Kept free of any
 * framework import so it can be unit-tested directly.
 */

export const PROJECT_TYPES = [
  { value: "extension", label: "Extension", hint: "Agrandir au sol" },
  { value: "surelevation", label: "Surélévation", hint: "Ajouter un étage" },
  { value: "renovation-globale", label: "Rénovation globale", hint: "Reprendre tout le logement" },
  { value: "restructuration", label: "Restructuration", hint: "Changer le plan, ouvrir un mur" },
  { value: "autre", label: "Autre projet", hint: "Décrivez-le plus loin" },
] as const;

export const PROPERTY_TYPES = [
  { value: "maison", label: "Maison" },
  { value: "appartement", label: "Appartement" },
] as const;

export const ERAS = [
  { value: "avant-1948", label: "Avant 1948" },
  { value: "1948-1974", label: "1948 – 1974" },
  { value: "1975-2000", label: "1975 – 2000" },
  { value: "apres-2000", label: "Après 2000" },
  { value: "inconnue", label: "Je ne sais pas" },
] as const;

export const OCCUPANCIES = [
  { value: "habite", label: "Nous y habitons" },
  { value: "inoccupe", label: "Il est inoccupé" },
  { value: "achat-en-cours", label: "Achat en cours" },
] as const;

export const WORKS = [
  "Ouverture de mur porteur",
  "Redistribution des pièces",
  "Cuisine",
  "Salles d'eau",
  "Isolation",
  "Menuiseries extérieures",
  "Chauffage / ventilation",
  "Électricité",
  "Façade",
  "Toiture",
] as const;

export const PROGRESS = [
  { value: "plans", label: "J'ai des plans de l'existant" },
  { value: "architecte", label: "Un architecte est déjà missionné" },
  { value: "autorisation", label: "Une autorisation est déposée ou obtenue" },
  { value: "aucune", label: "Aucune démarche pour l'instant" },
] as const;

export const TIMELINES = [
  { value: "moins-3-mois", label: "Dans les 3 mois" },
  { value: "3-6-mois", label: "Dans 3 à 6 mois" },
  { value: "6-12-mois", label: "Dans 6 à 12 mois" },
  { value: "plus-12-mois", label: "Dans plus d'un an" },
  { value: "reflexion", label: "Je me renseigne" },
] as const;

export const BUDGETS = [
  { value: "moins-40", label: "Moins de 40 000 €", max: 40_000 },
  { value: "40-80", label: "40 000 – 80 000 €", max: 80_000 },
  { value: "80-150", label: "80 000 – 150 000 €", max: 150_000 },
  { value: "150-300", label: "150 000 – 300 000 €", max: 300_000 },
  { value: "plus-300", label: "Plus de 300 000 €", max: Number.POSITIVE_INFINITY },
  { value: "inconnu", label: "Je ne sais pas encore", max: null },
] as const;

export const CALLBACK_SLOTS = [
  { value: "matin", label: "Matin", hint: "8 h – 12 h" },
  { value: "midi", label: "Midi", hint: "12 h – 14 h" },
  { value: "apres-midi", label: "Après-midi", hint: "14 h – 18 h" },
  { value: "soir", label: "Fin de journée", hint: "18 h – 19 h 30" },
] as const;

export const CONTACT_MODES = [
  { value: "telephone", label: "Par téléphone" },
  { value: "visio", label: "En visio" },
  { value: "visite", label: "Directement sur place" },
] as const;

export const OTHER_COMMUNE = "autre";

type ValueOf<T extends readonly { value: string }[]> = T[number]["value"];

export type ProjectRequest = {
  projectType: ValueOf<typeof PROJECT_TYPES>;
  propertyType: ValueOf<typeof PROPERTY_TYPES>;
  commune: string;
  otherCommune: string;
  era: ValueOf<typeof ERAS>;
  currentSurface: number | null;
  addedSurface: number | null;
  occupancy: ValueOf<typeof OCCUPANCIES>;
  works: string[];
  progress: string[];
  timeline: ValueOf<typeof TIMELINES>;
  budget: ValueOf<typeof BUDGETS>;
  description: string;
  photoCount: number;
  name: string;
  email: string;
  phone: string;
  callbackSlot: ValueOf<typeof CALLBACK_SLOTS>;
  contactMode: ValueOf<typeof CONTACT_MODES>;
  consent: boolean;
};

export type RequestField = keyof ProjectRequest;
export type FieldErrors = Partial<Record<RequestField, string>>;

export const EMPTY_REQUEST: ProjectRequest = {
  projectType: "" as ProjectRequest["projectType"],
  propertyType: "" as ProjectRequest["propertyType"],
  commune: "",
  otherCommune: "",
  era: "" as ProjectRequest["era"],
  currentSurface: null,
  addedSurface: null,
  occupancy: "" as ProjectRequest["occupancy"],
  works: [],
  progress: [],
  timeline: "" as ProjectRequest["timeline"],
  budget: "" as ProjectRequest["budget"],
  description: "",
  photoCount: 0,
  name: "",
  email: "",
  phone: "",
  callbackSlot: "" as ProjectRequest["callbackSlot"],
  contactMode: "telephone",
  consent: false,
};

/** Adds surface to the existing building — the only types where m² created matter. */
export function createsSurface(projectType: string): boolean {
  return projectType === "extension" || projectType === "surelevation";
}

/** Fields validated at each step of the form, in order. The last step is contact. */
export const STEP_FIELDS: RequestField[][] = [
  ["projectType", "propertyType"],
  ["commune", "otherCommune", "era", "currentSurface", "addedSurface", "occupancy"],
  ["works", "progress", "timeline", "budget", "description"],
  ["name", "email", "phone", "callbackSlot", "contactMode", "consent"],
];

const LIMITS = { text: 120, description: 2000, surface: 5000, photos: 12 } as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function oneOf(list: readonly { value: string }[], value: unknown): boolean {
  return typeof value === "string" && list.some((item) => item.value === value);
}

/** French phone numbers, landline or mobile, with or without +33 and separators. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s.\-()]/g, "");
  const national = digits.startsWith("+33") ? `0${digits.slice(3)}` : digits.startsWith("0033") ? `0${digits.slice(4)}` : digits;
  return /^0[1-9]\d{8}$/.test(national) ? national : null;
}

export function formatPhone(national: string): string {
  return national.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

/** Validates the given fields of a (possibly partial) request. */
export function validateFields(request: ProjectRequest, fields: RequestField[]): FieldErrors {
  const errors: FieldErrors = {};
  const need = new Set(fields);

  if (need.has("projectType") && !oneOf(PROJECT_TYPES, request.projectType)) {
    errors.projectType = "Choisissez le type de projet.";
  }
  if (need.has("propertyType") && !oneOf(PROPERTY_TYPES, request.propertyType)) {
    errors.propertyType = "Indiquez s'il s'agit d'une maison ou d'un appartement.";
  }
  if (need.has("commune")) {
    const known = COMMUNE_NAMES.includes(request.commune) || request.commune === OTHER_COMMUNE;
    if (!known) errors.commune = "Choisissez la commune du bien.";
  }
  if (need.has("otherCommune") && request.commune === OTHER_COMMUNE) {
    const other = request.otherCommune.trim();
    if (other.length < 2 || other.length > LIMITS.text) errors.otherCommune = "Précisez la commune.";
  }
  if (need.has("era") && !oneOf(ERAS, request.era)) {
    errors.era = "Choisissez une époque, ou « Je ne sais pas ».";
  }
  if (need.has("currentSurface")) {
    const surface = request.currentSurface;
    if (surface === null || !Number.isFinite(surface) || surface < 10 || surface > LIMITS.surface) {
      errors.currentSurface = "Indiquez la surface actuelle, même approximative (en m²).";
    }
  }
  if (need.has("addedSurface") && createsSurface(request.projectType)) {
    const added = request.addedSurface;
    if (added !== null && (!Number.isFinite(added) || added < 1 || added > LIMITS.surface)) {
      errors.addedSurface = "Indiquez une surface en m², ou laissez vide si vous ne savez pas.";
    }
  }
  if (need.has("occupancy") && !oneOf(OCCUPANCIES, request.occupancy)) {
    errors.occupancy = "Indiquez la situation du logement.";
  }
  if (need.has("works")) {
    const invalid = !Array.isArray(request.works) || request.works.some((work) => !(WORKS as readonly string[]).includes(work));
    if (invalid) errors.works = "Sélection invalide.";
  }
  if (need.has("progress")) {
    const invalid = !Array.isArray(request.progress) || request.progress.some((item) => !oneOf(PROGRESS, item));
    if (invalid) errors.progress = "Sélection invalide.";
  }
  if (need.has("timeline") && !oneOf(TIMELINES, request.timeline)) {
    errors.timeline = "Indiquez quand vous souhaitez démarrer.";
  }
  if (need.has("budget") && !oneOf(BUDGETS, request.budget)) {
    errors.budget = "Choisissez une enveloppe, ou « Je ne sais pas encore ».";
  }
  if (need.has("description") && request.description.length > LIMITS.description) {
    errors.description = `${LIMITS.description} caractères maximum.`;
  }
  if (need.has("photoCount") && (!Number.isInteger(request.photoCount) || request.photoCount < 0 || request.photoCount > LIMITS.photos)) {
    errors.photoCount = `${LIMITS.photos} photos maximum.`;
  }
  if (need.has("name")) {
    const name = request.name.trim();
    if (name.length < 2 || name.length > LIMITS.text) errors.name = "Indiquez votre nom.";
  }
  if (need.has("email")) {
    const email = request.email.trim();
    if (!EMAIL_PATTERN.test(email) || email.length > LIMITS.text) errors.email = "Adresse email invalide.";
  }
  if (need.has("phone") && !normalisePhone(request.phone)) {
    errors.phone = "Numéro de téléphone français invalide (10 chiffres).";
  }
  if (need.has("callbackSlot") && !oneOf(CALLBACK_SLOTS, request.callbackSlot)) {
    errors.callbackSlot = "Choisissez un créneau de rappel.";
  }
  if (need.has("contactMode") && !oneOf(CONTACT_MODES, request.contactMode)) {
    errors.contactMode = "Choisissez un mode d'échange.";
  }
  if (need.has("consent") && request.consent !== true) {
    errors.consent = "Votre accord est nécessaire pour que nous puissions vous recontacter.";
  }

  return errors;
}

const ALL_FIELDS = [...STEP_FIELDS.flat(), "photoCount"] as RequestField[];

/**
 * Parses an untrusted JSON body into a request. Unknown keys are dropped and
 * every value is coerced to its expected type before validation, so the
 * qualification below never sees anything but well-formed data.
 */
export function parseRequest(body: unknown): { ok: true; request: ProjectRequest } | { ok: false; errors: FieldErrors } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: { projectType: "Requête invalide." } };
  }
  const raw = body as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : "");
  const number = (key: string) => {
    const value = raw[key];
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };
  const list = (key: string) => (Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter((item): item is string => typeof item === "string").slice(0, 20) : []);

  const request: ProjectRequest = {
    projectType: text("projectType") as ProjectRequest["projectType"],
    propertyType: text("propertyType") as ProjectRequest["propertyType"],
    commune: text("commune"),
    otherCommune: text("otherCommune"),
    era: text("era") as ProjectRequest["era"],
    currentSurface: number("currentSurface"),
    addedSurface: number("addedSurface"),
    occupancy: text("occupancy") as ProjectRequest["occupancy"],
    works: list("works"),
    progress: list("progress"),
    timeline: text("timeline") as ProjectRequest["timeline"],
    budget: text("budget") as ProjectRequest["budget"],
    description: text("description"),
    photoCount: typeof raw.photoCount === "number" ? raw.photoCount : 0,
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    callbackSlot: text("callbackSlot") as ProjectRequest["callbackSlot"],
    contactMode: text("contactMode") as ProjectRequest["contactMode"],
    consent: raw.consent === true,
  };

  const errors = validateFields(request, ALL_FIELDS);
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, request };
}

/* ------------------------------------------------------------------------ */
/* Qualification: what the company receives before it picks up the phone.  */
/* ------------------------------------------------------------------------ */

export type Signal = { tone: "positive" | "neutral" | "attention"; label: string; detail: string };

export type ProjectBrief = {
  reference: string;
  priority: "A" | "B" | "C";
  priorityLabel: string;
  headline: string;
  signals: Signal[];
  checklist: string[];
  nextAction: string;
};

/**
 * Lower-bound cost ratios used only to flag an envelope that looks too low
 * for the project described. Orders of magnitude for the Paris western
 * suburbs, in € HT; a real deployment calibrates them with the company's own
 * figures before switching the form on.
 */
const COST_FLOOR = {
  extensionPerM2: 2_400,
  surelevationPerM2: 2_800,
  renovationPerM2: 900,
  restructurationMin: 45_000,
} as const;

export const COMPANY_MIN_BUDGET = 40_000;

function label<T extends readonly { value: string; label: string }[]>(list: T, value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

function estimateFloor(request: ProjectRequest): number | null {
  const current = request.currentSurface ?? 0;
  const added = request.addedSurface;
  switch (request.projectType) {
    case "extension":
      return added ? added * COST_FLOOR.extensionPerM2 : null;
    case "surelevation":
      return added ? added * COST_FLOOR.surelevationPerM2 : null;
    case "renovation-globale":
      return current ? current * COST_FLOOR.renovationPerM2 : null;
    case "restructuration":
      return COST_FLOOR.restructurationMin;
    default:
      return null;
  }
}

/** Planning pre-read. Always phrased as "probable": the PLU has the last word. */
export function urbanismHint(request: ProjectRequest): Signal | null {
  const added = request.addedSurface;
  const total = (request.currentSurface ?? 0) + (added ?? 0);

  if (createsSurface(request.projectType)) {
    if (added === null) {
      return { tone: "neutral", label: "Autorisation à déterminer", detail: "Surface créée non précisée : à mesurer lors de la visite." };
    }
    if (total > 150 && added > 20) {
      return {
        tone: "attention",
        label: "Permis de construire et architecte",
        detail: `Surface totale projetée d'environ ${total} m², au-delà de 150 m² : permis de construire et recours à un architecte obligatoires.`,
      };
    }
    if (added > 40) {
      return { tone: "attention", label: "Permis de construire probable", detail: `${added} m² créés, au-delà du seuil de la déclaration préalable.` };
    }
    if (added > 20) {
      return { tone: "neutral", label: "Déclaration préalable ou permis", detail: `${added} m² créés : déclaration préalable en zone urbaine du PLU, permis de construire sinon.` };
    }
    if (added >= 5) {
      return { tone: "positive", label: "Déclaration préalable probable", detail: `${added} m² créés, sous réserve du PLU et d'un éventuel secteur protégé.` };
    }
    return { tone: "positive", label: "Autorisation a priori non requise", detail: "Moins de 5 m² créés, hors secteur protégé." };
  }

  if (request.propertyType === "appartement" && request.works.includes("Ouverture de mur porteur")) {
    return { tone: "attention", label: "Accord de copropriété", detail: "Mur porteur en copropriété : autorisation de l'assemblée générale et note de calcul à prévoir." };
  }
  if (request.works.includes("Façade") || request.works.includes("Menuiseries extérieures") || request.works.includes("Toiture")) {
    return { tone: "neutral", label: "Déclaration préalable probable", detail: "Modification de l'aspect extérieur : déclaration préalable, avis ABF possible en secteur protégé." };
  }
  return null;
}

export function qualify(request: ProjectRequest, now: Date = new Date()): ProjectBrief {
  const signals: Signal[] = [];
  const checklist: string[] = [];

  // Zone
  const inZone = request.commune !== OTHER_COMMUNE;
  const commune = inZone ? request.commune : request.otherCommune.trim();
  signals.push(
    inZone
      ? { tone: "positive", label: "Dans la zone d'intervention", detail: `${commune} fait partie des communes desservies.` }
      : { tone: "attention", label: "Hors zone habituelle", detail: `${commune} : vérifier la distance avant de proposer une visite.` },
  );

  // Budget
  const budget = BUDGETS.find((item) => item.value === request.budget);
  const floor = estimateFloor(request);
  let budgetFits: boolean | null = null;
  if (!budget || budget.max === null) {
    signals.push({ tone: "neutral", label: "Enveloppe non communiquée", detail: "À aborder pendant le premier échange, avec des ordres de grandeur." });
  } else if (budget.max <= COMPANY_MIN_BUDGET) {
    budgetFits = false;
    signals.push({ tone: "attention", label: "Sous le seuil de l'entreprise", detail: "Moins de 40 000 € : orienter vers un artisan spécialisé." });
  } else if (floor !== null && budget.max < floor * 0.85) {
    budgetFits = false;
    signals.push({
      tone: "attention",
      label: "Enveloppe à clarifier",
      detail: `${budget.label} annoncés ; un projet de ce type démarre plutôt autour de ${Math.round(floor / 1000) * 1000} € HT.`,
    });
  } else {
    budgetFits = true;
    signals.push({ tone: "positive", label: "Enveloppe cohérente", detail: `${budget.label} pour ${label(PROJECT_TYPES, request.projectType).toLowerCase()}.` });
  }

  // Planning
  const urbanism = urbanismHint(request);
  if (urbanism) signals.push(urbanism);

  // Structure and technical flags
  if (request.works.includes("Ouverture de mur porteur") || request.projectType === "surelevation") {
    signals.push({ tone: "neutral", label: "Bureau d'études structure", detail: request.projectType === "surelevation" ? "Diagnostic des fondations avant chiffrage." : "Note de calcul nécessaire pour l'ouverture." });
    checklist.push("Prévoir le sondage du mur ou des fondations lors de la visite");
  }
  if (request.era === "avant-1948") {
    checklist.push("Bâti ancien : vérifier planchers bois et nature des maçonneries");
  }
  if (request.occupancy === "habite" && request.projectType !== "extension") {
    checklist.push("Logement habité : aborder le phasage ou un relogement temporaire");
  }
  if (request.occupancy === "achat-en-cours") {
    checklist.push("Achat en cours : proposer une visite avant la signature de l'acte");
  }
  if (!request.progress.includes("plans")) {
    checklist.push("Pas de plans de l'existant : relevé complet à prévoir");
  }
  if (request.photoCount > 0) {
    checklist.push(`${request.photoCount} photo${request.photoCount > 1 ? "s" : ""} jointe${request.photoCount > 1 ? "s" : ""} à consulter avant l'appel`);
  }

  // Priority
  const soon = request.timeline === "moins-3-mois" || request.timeline === "3-6-mois" || request.timeline === "6-12-mois";
  let priority: ProjectBrief["priority"] = "B";
  if (!inZone || budgetFits === false || request.timeline === "reflexion") priority = "C";
  else if (budgetFits === true && soon) priority = "A";

  const priorityLabel = {
    A: "Projet prioritaire — rappeler au créneau demandé",
    B: "Projet à qualifier — rappel dans les 2 jours ouvrés",
    C: "Projet à orienter — réponse écrite ou rappel court",
  }[priority];

  const nextAction =
    priority === "A"
      ? `Rappeler ${label(CALLBACK_SLOTS, request.callbackSlot).toLowerCase()} et proposer une visite (${label(CONTACT_MODES, request.contactMode).toLowerCase()}).`
      : priority === "B"
        ? "Rappeler pour préciser l'enveloppe et l'horizon, puis décider de la visite."
        : "Répondre par écrit avec les éléments manquants ou une orientation adaptée.";

  const surfacePart = createsSurface(request.projectType) && request.addedSurface ? ` · +${request.addedSurface} m²` : "";
  const headline = `${label(PROJECT_TYPES, request.projectType)} · ${label(PROPERTY_TYPES, request.propertyType).toLowerCase()} de ${request.currentSurface} m²${surfacePart} · ${commune}`;

  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = Math.abs(hash(`${request.email}|${request.phone}|${now.getTime()}`)).toString(36).slice(0, 4).toUpperCase().padEnd(4, "0");

  return {
    reference: `CC-${stamp}-${suffix}`,
    priority,
    priorityLabel,
    headline,
    signals,
    checklist,
    nextAction,
  };
}

function hash(input: string): number {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) | 0;
  }
  return value;
}

export const labels = { PROJECT_TYPES, PROPERTY_TYPES, ERAS, OCCUPANCIES, PROGRESS, TIMELINES, BUDGETS, CALLBACK_SLOTS, CONTACT_MODES };
export { label as labelOf };

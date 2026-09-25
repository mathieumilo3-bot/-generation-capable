/**
 * Normalisation de textes, nombres et unités issus de documents BTP français.
 * Fonctions pures, sans dépendance : utilisées par le parsing, le matching et
 * les exports.
 */

export type Cell = string | number | boolean | Date | null;

/** Minuscules, sans accents, ponctuation réduite à des espaces. */
export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/[^a-z0-9.,/%+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cellText(value: Cell | undefined): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Convertit un nombre écrit à la française ("1 234,50", "1.234,5", "12,5 €",
 * "1 250.00") ou un nombre natif. Renvoie null si la valeur n'est pas un
 * nombre non ambigu — on ne devine jamais.
 */
export function parseNumber(value: Cell | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let s = value
    .replace(/[  \s]/g, "")
    .replace(/€|eur(os?)?|ht|ttc/gi, "")
    .trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^[0-9.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Le dernier séparateur est le séparateur décimal.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const commas = s.split(",").length - 1;
    if (commas > 1) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  } else if (lastDot >= 0) {
    const dots = s.split(".").length - 1;
    // "1.234.567" = milliers ; "1.234" reste ambigu mais est lu comme décimal
    // (format anglo-saxon des exports Excel).
    if (dots > 1) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const UNIT_ALIASES: Record<string, string> = {
  u: "u",
  un: "u",
  unite: "u",
  unites: "u",
  unit: "u",
  pce: "u",
  pc: "u",
  pcs: "u",
  piece: "u",
  pieces: "u",
  nb: "u",
  nbre: "u",
  ml: "ml",
  "m.l": "ml",
  "m.l.": "ml",
  mlin: "ml",
  m: "m",
  metre: "m",
  metres: "m",
  m2: "m²",
  "m 2": "m²",
  mc: "m²",
  m3: "m³",
  "m 3": "m³",
  ens: "ens",
  "ens.": "ens",
  ensemble: "ens",
  ft: "forfait",
  fft: "forfait",
  forf: "forfait",
  forfait: "forfait",
  f: "forfait",
  kg: "kg",
  t: "t",
  tonne: "t",
  l: "l",
  litre: "l",
  h: "h",
  hr: "h",
  heure: "h",
  heures: "h",
  j: "j",
  jour: "j",
  jours: "j",
  pm: "pm",
  "p.m": "pm",
  "p.m.": "pm",
  lot: "lot",
  kw: "kW",
  jeu: "jeu",
  paire: "paire",
  rouleau: "rouleau",
  boite: "boîte",
  sac: "sac",
};

/** Unité normalisée (u, ml, m², ens, forfait…) ; l'originale est conservée à part. */
export function normalizeUnit(value: Cell | undefined): string | null {
  const raw = cellText(value);
  if (!raw) return null;
  const key = normalizeText(raw).replace(/\s+/g, " ");
  if (UNIT_ALIASES[key]) return UNIT_ALIASES[key];
  const compact = key.replace(/[\s.]/g, "");
  if (UNIT_ALIASES[compact]) return UNIT_ALIASES[compact];
  return raw.length <= 12 ? raw : null;
}

export function looksLikeUnit(value: Cell | undefined): boolean {
  const raw = cellText(value);
  if (!raw || raw.length > 12) return false;
  const key = normalizeText(raw);
  return Boolean(UNIT_ALIASES[key] || UNIT_ALIASES[key.replace(/[\s.]/g, "")]);
}

/** Code / référence comparable : majuscules, sans espaces ni ponctuation. */
export function normalizeCode(value: unknown): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, "").toUpperCase();
}

const STOPWORDS = new Set([
  "de", "du", "des", "la", "le", "les", "et", "en", "a", "au", "aux", "pour", "par", "sur",
  "avec", "sans", "y", "compris", "yc", "un", "une", "d", "l", "type", "ou", "dans", "the",
  "fourniture", "pose", "fourni", "f", "p", "fp", "mise", "oeuvre", "ref", "reference",
]);

/** Jetons significatifs d'une désignation (dimensions et références conservées). */
export function tokens(value: unknown): string[] {
  const text = normalizeText(value)
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\bdn\s+(\d+)/g, "dn$1")
    .replace(/(\d+)\s*x\s*(\d+)/g, "$1x$2")
    .replace(/(\d+(?:\.\d+)?)\s*(mm2|mm|cm|kw|w|m3\/h|l\/h|l|v|a|bar)\b/g, "$1$2");
  return text
    .split(/[\s,/+-]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Arrondi monétaire à 2 décimales, sans erreurs flottantes visibles. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Décode un CSV : UTF-8 strict, sinon Windows-1252 (exports Excel français). */
export function decodeText(buffer: Buffer | Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

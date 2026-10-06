/**
 * Décodage défensif des réponses serveur (JSON non typé → valeurs typées).
 * Aucun `any` : toute donnée inattendue produit une valeur neutre ou une erreur explicite.
 */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: unknown };

export function isRecord(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asRecord(v: unknown): JsonObject {
  return isRecord(v) ? v : {};
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Nombre entier ou décimal ; accepte aussi une chaîne numérique (bigint/numeric sérialisés en texte). */
export function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function mapRows<T>(v: unknown, decode: (row: JsonObject) => T): T[] {
  return asArray(v).filter(isRecord).map(decode);
}

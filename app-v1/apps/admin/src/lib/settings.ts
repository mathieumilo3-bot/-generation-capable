import { PublicSettingsSchema } from "@app/config";
import { formatEuros } from "@app/domain";
import { isEmail } from "./validation";

export type JsonKind = "null" | "boolean" | "number" | "string" | "array" | "object";

export function jsonKind(v: unknown): JsonKind {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  switch (typeof v) {
    case "boolean": return "boolean";
    case "number": return "number";
    case "string": return "string";
    default: return "object";
  }
}

const KIND_LABEL: Record<JsonKind, string> = {
  null: "vide (null)", boolean: "booléen (true/false)", number: "nombre", string: "texte", array: "liste", object: "objet",
};

export type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };

export const MAX_SETTING_JSON_CHARS = 20_000;

export function parseSettingJson(raw: string): ParseResult {
  const t = raw.trim();
  if (t === "") return { ok: false, error: "Saisissez une valeur JSON (ex. true, 1000, \"texte\", [1,2], {\"a\":1})." };
  if (t.length > MAX_SETTING_JSON_CHARS) return { ok: false, error: "Valeur trop volumineuse." };
  try {
    return { ok: true, value: JSON.parse(t) as unknown };
  } catch {
    return { ok: false, error: "JSON invalide : vérifiez les guillemets doubles, virgules et accolades." };
  }
}

export interface SettingContext {
  /** Valeur actuellement enregistrée. */
  current: unknown;
  /** Autres réglages (clé → valeur) pour les contrôles croisés (min ≤ max…). */
  others: Readonly<Record<string, unknown>>;
}

export type SettingResult =
  | { ok: true; value: unknown; warnings: string[]; risk: "normal" | "high" }
  | { ok: false; error: string };

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v);
}

function lookupPublicSchema(key: string) {
  const entry = Object.entries(PublicSettingsSchema.shape).find(([k]) => k === key);
  return entry ? entry[1] : null;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Libellé d'aide pour un réglage en centimes : 1000 → « 10,00 € » ; [500,1000] → « 5,00 €, 10,00 € ». */
export function centsHint(key: string, value: unknown): string | null {
  if (!key.endsWith("_cents")) return null;
  if (isInt(value)) return formatEuros(value);
  if (Array.isArray(value) && value.every(isInt)) return value.map((c) => formatEuros(c)).join(", ");
  return null;
}

export function validateSettingValue(key: string, raw: string, ctx: SettingContext): SettingResult {
  const parsed = parseSettingJson(raw);
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  const warnings: string[] = [];
  let risk: "normal" | "high" = "normal";

  const isRetention = key.startsWith("retention.");
  const curKind = jsonKind(ctx.current);
  const newKind = jsonKind(value);

  if (isRetention) {
    if (value !== null && !(isInt(value) && value >= 1 && value <= 3650)) {
      return { ok: false, error: "Durée en jours : un entier entre 1 et 3650, ou null (conservation illimitée)." };
    }
    if (value !== null) warnings.push("Une durée de conservation finie entraîne la suppression définitive des fichiers anciens : décision business à valider.");
    risk = "high";
  } else if (curKind !== "null" && newKind !== curKind) {
    return { ok: false, error: `Le type doit rester ${KIND_LABEL[curKind]} (valeur proposée : ${KIND_LABEL[newKind]}).` };
  }

  const schema = lookupPublicSchema(key);
  if (schema) {
    const res = schema.safeParse(value);
    if (!res.success) return { ok: false, error: "Valeur refusée : l'application cliente n'accepterait pas ce format pour ce réglage." };
  }

  if (key.endsWith("_cents")) {
    const ok = isInt(value) ? value >= 0 : Array.isArray(value) && value.every((v) => isInt(v) && v >= 0);
    if (!ok) return { ok: false, error: "Montant(s) en centimes : entiers positifs ou nuls uniquement (ex. 1000 = 10,00 €)." };
  }
  if (key.endsWith("_bytes") && !(isInt(value) && value > 0)) {
    return { ok: false, error: "Taille en octets : entier strictement positif." };
  }

  const merged = (k: string): unknown => (k === key ? value : ctx.others[k]);

  switch (key) {
    case "maintenance.enabled":
      risk = "high";
      if (value === true) warnings.push("Le mode maintenance bloque immédiatement toute nouvelle commande de vidéo.");
      break;
    case "wallet.min_topup_cents":
    case "wallet.max_topup_cents": {
      const min = merged("wallet.min_topup_cents");
      const max = merged("wallet.max_topup_cents");
      if (isInt(min) && min < 50) return { ok: false, error: "La recharge minimale ne peut pas être inférieure à 0,50 €." };
      if (isInt(max) && max > 10_000_000) return { ok: false, error: "La recharge maximale ne peut pas dépasser 100 000 €." };
      if (isInt(min) && isInt(max) && min > max) return { ok: false, error: "La recharge minimale doit rester inférieure ou égale à la recharge maximale." };
      risk = "high";
      break;
    }
    case "wallet.topup_presets_cents": {
      const min = merged("wallet.min_topup_cents");
      const max = merged("wallet.max_topup_cents");
      if (Array.isArray(value)) {
        if (value.length === 0) return { ok: false, error: "Au moins un montant proposé est requis." };
        if (new Set(value).size !== value.length) return { ok: false, error: "Montants en double." };
        if (isInt(min) && isInt(max) && value.some((v) => isInt(v) && (v < min || v > max))) {
          warnings.push("Certains montants proposés sont hors des bornes de recharge (minimum / maximum) : ils seraient refusés au paiement.");
        }
      }
      break;
    }
    case "wallet.low_balance_threshold_cents":
      break;
    case "upload.max_file_bytes":
    case "upload.max_total_bytes": {
      const file = merged("upload.max_file_bytes");
      const total = merged("upload.max_total_bytes");
      if (isInt(file) && isInt(total) && file > total) return { ok: false, error: "La taille maximale par fichier ne peut pas dépasser la taille maximale par projet." };
      break;
    }
    case "upload.max_files":
      if (!(isInt(value) && value >= 1 && value <= 200)) return { ok: false, error: "Nombre de fichiers : entier entre 1 et 200." };
      break;
    case "fx.usd_eur":
      if (typeof value !== "number" || !(value > 0 && value < 10)) return { ok: false, error: "Taux de change : nombre strictement entre 0 et 10 (ex. 0.92)." };
      warnings.push("Ce taux convertit les coûts moteur : il modifie les marges calculées pour les prochains jobs.");
      break;
    case "app.min_version": {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const entries = Object.entries(value);
        if (entries.some(([, v]) => typeof v !== "string" || !SEMVER_RE.test(v))) {
          return { ok: false, error: "Versions au format x.y.z pour chaque plateforme (ex. \"1.2.0\")." };
        }
      }
      risk = "high";
      warnings.push("Relever la version minimale force la mise à jour des applications plus anciennes.");
      break;
    }
    case "product.support_email":
      if (typeof value !== "string" || !isEmail(value)) return { ok: false, error: "Adresse e-mail invalide." };
      break;
    case "payments.providers":
    case "payments.store_packs":
    case "payments.auto_reload_enabled":
      risk = "high";
      warnings.push("Ce réglage pilote les paiements : vérifiez docs/STORE_PAYMENT_POLICY.md avant de valider.");
      break;
    default:
      if (key.startsWith("urls.")) {
        if (typeof value !== "string" || !/^https:\/\/[^\s]+$/.test(value)) return { ok: false, error: "URL https:// valide requise." };
      }
  }

  if (deepEqual(value, ctx.current)) return { ok: false, error: "Aucun changement par rapport à la valeur actuelle." };
  return { ok: true, value, warnings, risk };
}

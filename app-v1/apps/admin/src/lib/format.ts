import { formatEuros } from "@app/domain";

const TZ = "Europe/Paris";
const NBSP = "\u00a0";

function validDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function formatDateTime(iso: string | null | undefined): string {
  const d = validDate(iso);
  return d ? dateTimeFmt.format(d) : "—";
}

export function formatDate(iso: string | null | undefined): string {
  const d = validDate(iso);
  return d ? dateFmt.format(d) : "—";
}

export function formatTime(iso: string | null | undefined): string {
  const d = validDate(iso);
  return d ? timeFmt.format(d) : "—";
}

/** « il y a 5 min », « il y a 3 j » — pour les colonnes « dernière activité ». */
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  const d = validDate(iso);
  if (!d) return "—";
  const sec = Math.round((now.getTime() - d.getTime()) / 1000);
  if (sec < 0) return formatDateTime(iso);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days} j`;
  return formatDate(iso);
}

/**
 * µ€ → « 0,0042 € » / « 1,50 € » en arithmétique entière (pas de flottant stocké).
 * 1 € = 1 000 000 µ€. Précision d'affichage : 4 décimales, jamais moins de 2.
 */
export function formatMicroEuros(micro: number): string {
  if (!Number.isFinite(micro)) return "—";
  const rounded = Math.round(micro);
  const sign = rounded < 0 ? "−" : "";
  const abs = Math.abs(rounded);
  const units = Math.floor((abs + 50) / 100); // unités de 0,0001 €
  const euros = Math.floor(units / 10_000);
  const dec = String(units % 10_000).padStart(4, "0").replace(/0+$/, "").padEnd(2, "0");
  const intPart = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  return `${sign}${intPart},${dec}${NBSP}€`;
}

export function formatInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
}

/** Pourcentage entier (0–100) de part/total ; 0 si total nul. */
export function percentOf(part: number, total: number): number {
  if (total <= 0 || part <= 0) return 0;
  return Math.round((part * 100) / total);
}

export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Montant signé du ledger : +25,00 € / −4,84 €. */
export function formatSignedEuros(cents: number): string {
  return formatEuros(cents, { signed: true });
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "null";
  } catch {
    return String(value);
  }
}

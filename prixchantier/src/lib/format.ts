const euro0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euro2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });

/** Montant arrondi à l'euro, espaces insécables remplacés par des espaces simples. */
export function euros(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return euro0.format(n).replace(/[  ]/g, " ");
}

export function euros2(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return euro2.format(n).replace(/[  ]/g, " ");
}

export function quantity(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return num.format(n).replace(/[  ]/g, " ");
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function longDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d;
  return dateFmt.format(date);
}

export function frDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d;
  return shortDate.format(date);
}

/** « Aujourd'hui 14:32 », « Hier 17:42 », sinon « 12/09/2026 09:15 ». */
export function relativeDateTime(iso: string, now = new Date()) {
  const d = new Date(iso);
  const day = (x: Date) => shortDate.format(x);
  const yesterday = new Date(now.getTime() - 86_400_000);
  const time = timeFmt.format(d);
  if (day(d) === day(now)) return `Aujourd'hui ${time}`;
  if (day(d) === day(yesterday)) return `Hier ${time}`;
  return `${day(d)} ${time}`;
}

/** « 428 Mo / 1,2 Go » (§14) — unités décimales comme les systèmes d'exploitation grand public. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go", "To"];
  let v = bytes;
  let i = -1;
  do { v /= 1000; i++; } while (v >= 1000 && i < units.length - 1);
  const rounded = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[i]}`;
}

/** 83 → « 1:23 » ; 3725 → « 1:02:05 ». */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** Prénom affichable depuis un profil ; jamais l'e-mail brut ni un relais Apple. */
export function greetingName(p: { first_name?: string | null; email?: string | null }): string | null {
  const first = p.first_name?.trim();
  return first && first.length > 0 ? first : null;
}

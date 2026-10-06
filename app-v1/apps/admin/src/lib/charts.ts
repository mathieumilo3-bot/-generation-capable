import { percentOf } from "./format";

export interface BarDatum { key: string; label: string; value: number }

/**
 * Largeur relative (0–100) de chaque barre par rapport au maximum. Une valeur non nulle
 * garde au moins 2 % pour rester visible ; une valeur nulle reste à 0 (aucune donnée inventée).
 */
export function layoutBars<T extends BarDatum>(data: readonly T[]): Array<T & { pct: number }> {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  return data.map((d) => {
    const raw = percentOf(d.value, max);
    return { ...d, pct: d.value > 0 ? Math.max(raw, 2) : 0 };
  });
}

export interface Segment { key: string; label: string; value: number }
export interface SegmentLayout extends Segment { pct: number; offset: number }

/** Segments empilés : largeurs proportionnelles, cumul des offsets. Total nul → aucun segment. */
export function layoutSegments(parts: readonly Segment[]): SegmentLayout[] {
  const total = parts.reduce((s, p) => s + Math.max(p.value, 0), 0);
  if (total <= 0) return parts.map((p) => ({ ...p, pct: 0, offset: 0 }));
  let acc = 0;
  return parts.map((p) => {
    const pct = (Math.max(p.value, 0) * 100) / total;
    const out = { ...p, pct, offset: acc };
    acc += pct;
    return out;
  });
}

/** Taux de réussite entier (réussis / (réussis + échoués)) ; null s'il n'y a aucun job terminé. */
export function successRate(completed: number, failed: number): number | null {
  const done = completed + failed;
  return done > 0 ? percentOf(completed, done) : null;
}

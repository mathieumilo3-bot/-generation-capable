export interface PricingWindow {
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

/** Miroir de `private.pricing_rule_is_current` : active ET dans sa fenêtre de validité. */
export function isCurrentRule(rule: PricingWindow, now: Date = new Date()): boolean {
  const from = new Date(rule.effectiveFrom).getTime();
  const to = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : null;
  const t = now.getTime();
  return rule.active && Number.isFinite(from) && from <= t && (to === null || (Number.isFinite(to) && to > t));
}

export const MODE_LABELS: Record<string, string> = {
  edit_rushes: "Montage de rushs",
  autonomous: "Création autonome",
  revision: "Modification",
};

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

/** « 0–30 s », « 1–2 min » : bornes en secondes → libellé court. */
export function formatDurationRange(minSec: number, maxSec: number): string {
  const f = (s: number) => (s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`);
  return `${f(minSec)} – ${f(maxSec)}`;
}

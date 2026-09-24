/**
 * Colour handling for the preview: read the colours a company actually uses
 * on its site, and derive ONE dominant colour and ONE accent that pass
 * contrast. A brand colour that fails contrast is darkened — never replaced
 * by an invented one — and when nothing usable was observed the trade's
 * neutral accent is used and labelled as such.
 */

export type Rgb = { r: number; g: number; b: number };

export function parseColor(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return `#${h}`;
  }
  const rgb = value.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (rgb) {
    const alpha = rgb[4] ? (rgb[4].endsWith("%") ? Number(rgb[4].slice(0, -1)) / 100 : Number(rgb[4])) : 1;
    if (alpha < 0.9) return null;
    const parts = [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)));
    return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }
  return null;
}

export function toRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("")}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const { r, g, b } = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function saturation(hex: string): number {
  const { r, g, b } = toRgb(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function mix(hex: string, target: string, amount: number): string {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex({ r: a.r + (b.r - a.r) * amount, g: a.g + (b.g - a.g) * amount, b: a.b + (b.b - a.b) * amount });
}

/** Darkens a colour until white text on it reaches `min` contrast. */
export function ensureContrastOnWhiteText(hex: string, min = 4.6): string {
  let color = hex;
  for (let i = 0; i < 20 && contrast(color, "#ffffff") < min; i += 1) color = mix(color, "#000000", 0.08);
  return color;
}

/** A colour worth treating as a brand colour: saturated, not near white or black. */
export function isBrandCandidate(hex: string): boolean {
  const l = luminance(hex);
  return saturation(hex) >= 0.22 && l > 0.02 && l < 0.8;
}

const NAMED_VAR = /--[\w-]*(?:primary|brand|accent|main|theme|secondary|global-color-primary|global-color-accent)[\w-]*\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi;
const ANY_COLOR = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\(\s*\d{1,3}[\s,]+\d{1,3}[\s,]+\d{1,3}(?:[\s,/]+[\d.]+%?)?\s*\)/gi;

/**
 * Ranks the colours used by a page's own CSS. Named brand variables
 * (--primary, Elementor/WordPress presets…) and theme-color weigh most;
 * frequency breaks ties. Greys, whites and blacks are ignored.
 */
export function rankObservedColors(cssSources: string[], themeColor?: string): string[] {
  const scores = new Map<string, number>();
  const bump = (raw: string, weight: number) => {
    const hex = parseColor(raw);
    if (!hex || !isBrandCandidate(hex)) return;
    scores.set(hex, (scores.get(hex) ?? 0) + weight);
  };
  if (themeColor) bump(themeColor, 12);
  for (const css of cssSources) {
    const bounded = css.slice(0, 400_000);
    for (const match of bounded.matchAll(NAMED_VAR)) bump(match[1], 8);
    for (const match of bounded.matchAll(ANY_COLOR)) bump(match[0], 1);
  }
  // Merge near-duplicates (shades a designer uses for hover states).
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  const distinct: string[] = [];
  for (const hex of ranked) {
    const { r, g, b } = toRgb(hex);
    const close = distinct.some((other) => {
      const o = toRgb(other);
      return Math.abs(o.r - r) + Math.abs(o.g - g) + Math.abs(o.b - b) < 48;
    });
    if (!close) distinct.push(hex);
    if (distinct.length >= 4) break;
  }
  return distinct;
}

export type PreviewPalette = {
  /** Dominant colour: CTAs, key accents. White text on it passes AA. */
  primary: string;
  /** Very light tint of the primary for quiet section backgrounds. */
  tint: string;
  /** Ink and paper stay neutral so the page reads premium whatever the brand. */
  ink: string;
  paper: string;
  muted: string;
  line: string;
  /** Where the primary came from. */
  source: "brand" | "trade";
  observed?: string;
};

export function derivePalette(observed: string[] | null | undefined, tradeAccent: string): PreviewPalette {
  const brand = observed?.find(isBrandCandidate);
  const base = brand ?? tradeAccent;
  const primary = ensureContrastOnWhiteText(base);
  return {
    primary,
    tint: mix(primary, "#ffffff", 0.93),
    ink: "#16150f",
    paper: "#fbfaf7",
    muted: "#5d5a52",
    line: "#e7e3da",
    source: brand ? "brand" : "trade",
    ...(brand ? { observed: brand } : {}),
  };
}

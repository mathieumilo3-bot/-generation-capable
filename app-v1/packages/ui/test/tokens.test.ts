import { describe, expect, it } from "vitest";
import { colors, cssVariables, radii, sizes, type } from "../src/tokens";

/** Luminance relative WCAG 2.x et ratio de contraste. */
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05); };

describe("palette (§2) et accessibilité (§44)", () => {
  it("respecte exactement les couleurs de la direction artistique", () => {
    expect(colors).toMatchObject({ background: "#FFFFFF", surface: "#F5F5F7", surfaceAlt: "#FAFAFA", text: "#1D1D1F", textSecondary: "#6E6E73", border: "#E5E5EA", accent: "#FF3B30", accentPressed: "#D70015", success: "#34C759", warning: "#FF9F0A" });
  });
  it("texte principal et secondaire : contraste AA (≥ 4,5:1) sur blanc et sur surface", () => {
    for (const bg of [colors.background, colors.surface]) {
      expect(contrast(colors.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("texte blanc sur bouton rouge : AA pour grand texte (≥ 3:1) ; pressé : ≥ 4,5:1", () => {
    expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.onAccent, colors.accentPressed)).toBeGreaterThanOrEqual(4.5);
  });
  it("texte d'erreur (rouge pressé) lisible sur fond d'alerte", () => {
    expect(contrast(colors.accentPressed, colors.accentTint)).toBeGreaterThanOrEqual(4.5);
  });
  it("zones tactiles ≥ 44 pt et hiérarchie typographique de la spec", () => {
    expect(sizes.minTouch).toBeGreaterThanOrEqual(44);
    expect(sizes.buttonSmall).toBeGreaterThanOrEqual(44);
    expect(type.largeTitle.fontSize).toBeGreaterThanOrEqual(32); expect(type.largeTitle.fontSize).toBeLessThanOrEqual(34);
    expect(type.title.fontSize).toBeGreaterThanOrEqual(26); expect(type.title.fontSize).toBeLessThanOrEqual(28);
    expect(type.body.fontSize).toBeGreaterThanOrEqual(16); expect(type.body.fontSize).toBeLessThanOrEqual(17);
    expect(radii.lg).toBeGreaterThanOrEqual(18); expect(radii.xl).toBeLessThanOrEqual(22);
  });
  it("variables CSS pour le back-office", () => { expect(cssVariables()).toContain("--c-accent-pressed: #D70015;"); });
});

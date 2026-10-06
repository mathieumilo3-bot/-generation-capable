/**
 * Design tokens — direction « Apple d'abord » (§2). Rouge rare : CTA principaux,
 * éléments actifs, marque. Aucune ombre lourde, aucun dégradé.
 * Source unique pour l'app (React Native) ET l'admin (variables CSS).
 */
export const colors = {
  background: "#FFFFFF",
  surface: "#F5F5F7",
  surfaceAlt: "#FAFAFA",
  text: "#1D1D1F",
  textSecondary: "#6E6E73",
  border: "#E5E5EA",
  accent: "#FF3B30",
  accentPressed: "#D70015",
  success: "#34C759",
  warning: "#FF9F0A",
  onAccent: "#FFFFFF",
  // Teintes dérivées (fonds d'alertes) — volontairement très pâles.
  accentTint: "#FFF1F0",
  successTint: "#EEFAF1",
  warningTint: "#FFF7E8",
  overlay: "rgba(0,0,0,0.4)",
  disabled: "#C7C7CC",
} as const;

/** Texte sur fond blanc : #6E6E73 = 5,0:1 (AA) ; #FF3B30 sur blanc = 3,6:1 → réservé aux grands textes/icônes, jamais au corps de texte. */
export const radii = { sm: 12, md: 16, lg: 20, xl: 22, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, huge: 40 } as const;

export const sizes = {
  minTouch: 48,           // ≥ 44 pt (iOS) / 48 dp (Android)
  button: 56,
  buttonSmall: 44,
  input: 56,
  contentMaxWidth: 560,   // web : contenu centré, grandes zones blanches
  tabBar: 64,
} as const;

export const motion = { fast: 150, base: 200, slow: 250, spring: { damping: 18, stiffness: 220, mass: 0.9 } } as const;

export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700" as const, letterSpacing: 0.3 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const, letterSpacing: 0.2 },
  section: { fontSize: 21, lineHeight: 26, fontWeight: "600" as const },
  body: { fontSize: 17, lineHeight: 24, fontWeight: "400" as const },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: "600" as const },
  button: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  secondary: { fontSize: 15, lineHeight: 21, fontWeight: "400" as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  money: { fontSize: 44, lineHeight: 50, fontWeight: "700" as const, letterSpacing: 0.2 },
} as const;
export type TypeVariant = keyof typeof type;

/** Variables CSS pour le back-office web (même palette, autre densité). */
export function cssVariables(): string {
  const toKebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return Object.entries(colors).map(([k, v]) => `--c-${toKebab(k)}: ${v};`).join("\n");
}

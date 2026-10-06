import { describe, expect, it } from "vitest";
import { formatDateTime, formatMicroEuros, formatRelative, percentOf, shortId, truncate, formatInt } from "../src/lib/format";

const sp = (v: string | null): string | null => (v === null ? null : v.replace(/[\u00a0\u202f]/g, " "));

describe("formatMicroEuros (µ€ → €, arithmétique entière)", () => {
  it("affiche au moins 2 décimales", () => {
    expect(sp(formatMicroEuros(1_500_000))).toBe("1,50 €");
    expect(sp(formatMicroEuros(0))).toBe("0,00 €");
    expect(sp(formatMicroEuros(2_000_000))).toBe("2,00 €");
  });
  it("conserve la précision sous le centime (4 décimales)", () => {
    expect(sp(formatMicroEuros(4_200))).toBe("0,0042 €");
    expect(sp(formatMicroEuros(123_456))).toBe("0,1235 €");
  });
  it("sépare les milliers", () => {
    expect(sp(formatMicroEuros(1_234_567_000_000))).toBe("1 234 567,00 €");
  });
  it("gère négatif et valeurs invalides", () => {
    expect(sp(formatMicroEuros(-500_000))).toBe("−0,50 €");
    expect(sp(formatMicroEuros(Number.NaN))).toBe("—");
  });
});

describe("dates", () => {
  it("formate en Europe/Paris, tiret si absent ou invalide", () => {
    expect(formatDateTime("2026-01-15T11:30:00Z")).toContain("15/01/2026");
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("pas une date")).toBe("—");
  });
  it("formatRelative", () => {
    const now = new Date("2026-03-10T12:00:00Z");
    expect(formatRelative("2026-03-10T11:59:50Z", now)).toBe("à l'instant");
    expect(formatRelative("2026-03-10T11:30:00Z", now)).toBe("il y a 30 min");
    expect(formatRelative("2026-03-10T07:00:00Z", now)).toBe("il y a 5 h");
    expect(formatRelative("2026-03-05T12:00:00Z", now)).toBe("il y a 5 j");
    expect(formatRelative(null, now)).toBe("—");
  });
});

describe("utilitaires", () => {
  it("percentOf", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 10)).toBe(0);
    expect(percentOf(5, 0)).toBe(0);
  });
  it("shortId / truncate / formatInt", () => {
    expect(shortId("123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567");
    expect(shortId(null)).toBe("—");
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
    expect(truncate("abc", 5)).toBe("abc");
    expect(sp(formatInt(1234567))).toBe("1 234 567");
  });
});

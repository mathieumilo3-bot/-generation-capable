import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readWorkbook } from "@/lib/parsing/spreadsheet";
import { parseDpgf } from "@/lib/parsing/dpgf";
import { ALL_LINES, DPGF_LOTS } from "../fixtures/data";

const file = (name: string) => readFileSync(join(__dirname, "../fixtures/files", name));

function expectLinesMatch(lines: ReturnType<typeof parseDpgf>["lines"], expected: typeof ALL_LINES) {
  expect(lines).toHaveLength(expected.length);
  lines.forEach((line, i) => {
    expect(line.code).toBe(expected[i].code);
    expect(line.designation).toBe(expected[i].designation);
    expect(line.quantity).toBe(expected[i].qty);
    expect(line.original.unit).toBe(expected[i].unit);
  });
}

describe("DPGF standard (xlsx)", () => {
  const result = parseDpgf(readWorkbook(file("dpgf-standard.xlsx"), "xlsx"));

  it("extrait toutes les lignes, dans l'ordre, sans en inventer", () => {
    expect(ALL_LINES.length).toBeGreaterThanOrEqual(50);
    expectLinesMatch(result.lines, ALL_LINES);
  });

  it("conserve la position source exacte", () => {
    // Lignes 1-5 : titre, 6 : en-tête, 7 : lot, 8 : section, 9 : 1re ligne.
    expect(result.lines[0]).toMatchObject({ sourceSheet: "DPGF", sourceRow: 9, code: "10.1.1" });
  });

  it("rattache lot et section, et les suites descriptives à la ligne précédente", () => {
    expect(result.lines[0].lot).toBe(DPGF_LOTS[0].lot);
    expect(result.lines[0].original.section).toBe("10.1 Production de chaleur");
    expect(result.lines[0].description).toBe("y compris raccordements, accessoires et toutes sujétions");
    const plomberie = result.lines.find((l) => l.code === "11.2.1")!;
    expect(plomberie.lot).toBe(DPGF_LOTS[1].lot);
  });

  it("ignore les sous-totaux, totaux et TVA et les comptabilise", () => {
    const report = result.sheets[0];
    expect(report.status).toBe("parsed");
    expect(report.headerRow).toBe(6);
    // 12 sous-totaux de section + 3 totaux de lot + total général + TVA
    const sections = DPGF_LOTS.reduce((n, l) => n + l.sections.length, 0);
    expect(report.ignoredTotals).toBe(sections + DPGF_LOTS.length + 2);
    expect(result.lines.some((l) => /total|tva/i.test(l.designation))).toBe(false);
  });

  it("normalise les unités en gardant l'original", () => {
    const ens = result.lines.find((l) => l.code === "10.1.7")!;
    expect(ens.unit).toBe("ens");
    expect(ens.original.unit).toBe("Ens");
    const m2 = result.lines.find((l) => l.code === "10.4.4")!;
    expect(m2.unit).toBe("m²");
    const ft = result.lines.find((l) => l.code === "10.5.4")!;
    expect(ft.unit).toBe("forfait");
  });

  it("attribue une confiance élevée aux lignes complètes", () => {
    expect(result.lines.every((l) => l.confidence >= 0.9)).toBe(true);
  });
});

describe("DPGF multi-onglets", () => {
  const result = parseDpgf(readWorkbook(file("dpgf-multi-onglets.xlsx"), "xlsx"));

  it("lit chaque onglet de lot et ignore page de garde, récap et feuille masquée", () => {
    expectLinesMatch(result.lines, ALL_LINES);
    const byName = Object.fromEntries(result.sheets.map((s) => [s.name, s]));
    expect(byName["Page de garde"].status).toBe("skipped");
    expect(byName["Récapitulatif"].lines).toBe(0);
    expect(byName["Paramètres"]).toMatchObject({ status: "skipped", reason: "Feuille masquée" });
  });

  it("utilise l'intitulé de lot de l'onglet", () => {
    const first = result.lines[0];
    expect(first.lot).toBe(DPGF_LOTS[0].lot);
    expect(first.sourceSheet).toBe("LOT 10 CHAUFFAGE");
  });
});

describe("DPGF avec cellules fusionnées", () => {
  const result = parseDpgf(readWorkbook(file("dpgf-cellules-fusionnees.xlsx"), "xlsx"));
  const lot10 = DPGF_LOTS[0].sections.flatMap((s) => s.lines);

  it("détecte l'en-tête sur deux lignes fusionnées et lit les désignations fusionnées", () => {
    expect(result.sheets[0].headerRow).toBe(6);
    expectLinesMatch(result.lines, lot10);
  });

  it("n'étale jamais une fusion horizontale dans la colonne quantité", () => {
    expect(result.lines.every((l) => typeof l.quantity === "number")).toBe(true);
  });
});

describe("DPGF XLS (Excel 97-2003)", () => {
  it("donne exactement le même résultat que le XLSX", () => {
    const result = parseDpgf(readWorkbook(file("dpgf-legacy.xls"), "xls"));
    expectLinesMatch(result.lines, ALL_LINES);
  });
});

describe("DPGF CSV (point-virgule, Windows-1252)", () => {
  const result = parseDpgf(readWorkbook(file("dpgf-lot11.csv"), "csv"));
  const lot11 = DPGF_LOTS[1].sections.flatMap((s) => s.lines);

  it("détecte séparateur et encodage, et décode les accents", () => {
    expectLinesMatch(result.lines, lot11);
    expect(result.lines.find((l) => l.code === "11.4.5")!.designation).toBe("Évier inox 2 bacs avec mitigeur");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readWorkbook } from "@/lib/parsing/spreadsheet";
import { parseNumber, cellText } from "@/lib/parsing/normalize";
import { matchOfferLines, designationSimilarity, type RequestedRef } from "@/lib/matching/match";
import { DPGF_LOTS } from "../fixtures/data";

const CONSULTED = [...DPGF_LOTS[0].sections[1].lines, ...DPGF_LOTS[0].sections[2].lines];
const requested: RequestedRef[] = CONSULTED.map((l) => ({
  id: l.code,
  code: l.code,
  designation: l.designation,
  quantity: l.qty,
  unit: l.unit,
}));

function offerRowsFromSheet(file: string, desCol: number, qtyCol: number, refCol: number | null) {
  const wb = readWorkbook(readFileSync(join(__dirname, "../fixtures/files", file)), "xlsx");
  return wb.sheets[0].rows
    .filter((r) => parseNumber(r[qtyCol]) !== null && cellText(r[desCol]))
    .map((r) => ({
      supplier_reference: refCol === null ? null : cellText(r[refCol]) || null,
      supplier_designation: cellText(r[desCol]),
      quantity: parseNumber(r[qtyCol]),
      is_fee: /frais de port/i.test(cellText(r[desCol])),
    }));
}

describe("rapprochement des lignes fournisseur", () => {
  it("ne confond pas des dimensions différentes", () => {
    expect(designationSimilarity("Tube acier noir DN20", "Tube acier noir DN25")).toBeLessThan(0.5);
    expect(designationSimilarity("Tube acier noir DN20 y compris supports", "TUBE ACIER NOIR DN 20")).toBeGreaterThan(0.8);
  });

  it("devis fournisseur B (références propres, 2 lignes absentes, 1 variante, frais de port)", () => {
    const rows = offerRowsFromSheet("devis-fournisseur-b.xlsx", 1, 2, 0);
    const res = matchOfferLines(requested, rows);
    const matchedIds = res.filter((r) => r.projectLineId).map((r) => r.projectLineId);
    // Aucune ligne rattachée deux fois.
    expect(new Set(matchedIds).size).toBe(matchedIds.length);
    // Les lignes absentes (index 3 et 9) ne sont jamais « trouvées ».
    expect(matchedIds).not.toContain(CONSULTED[3].code);
    expect(matchedIds).not.toContain(CONSULTED[9].code);
    // Toutes les correspondances « sûres » sont correctes.
    res.forEach((r, i) => {
      if (r.status !== "matched") return;
      const expected = rows[i].supplier_designation.startsWith("VARIANTE") ? "10.3.1" : CONSULTED.find((c) => c.designation === rows[i].supplier_designation)?.code;
      expect(r.projectLineId).toBe(expected);
    });
    // Les frais de port ne sont rattachés à aucune ligne.
    const port = rows.findIndex((r) => r.is_fee);
    expect(res[port].projectLineId).toBeNull();
    // La variante est rapprochée du bon radiateur (type 22 L800), pas du L1200.
    const variante = rows.findIndex((r) => r.supplier_designation.startsWith("VARIANTE"));
    expect(res[variante].projectLineId).toBe("10.3.1");
  });

  it("devis sans références identiques : aucune fausse correspondance sûre", () => {
    const rows = offerRowsFromSheet("devis-sans-references.xlsx", 0, 1, null);
    const res = matchOfferLines(requested, rows);
    let correct = 0;
    res.forEach((r, i) => {
      if (r.status === "matched") {
        expect(r.projectLineId).toBe(CONSULTED[i].code);
        correct++;
      }
    });
    // Les désignations reformulées (argot négoce) restent à vérifier ou non rattachées.
    const reworded = rows.findIndex((r) => r.supplier_designation.startsWith("Acier noir tarif 20"));
    expect(res[reworded].status).not.toBe("matched");
    expect(correct).toBeGreaterThanOrEqual(CONSULTED.length - 5);
  });

  it("l'avis de l'IA peut confirmer un rapprochement, jamais l'imposer seul", () => {
    const [r] = matchOfferLines(requested, [
      { supplier_reference: null, supplier_designation: "Tête thermostatique + corps de robinet", quantity: 30, is_fee: false, aiMatchId: "10.3.3", aiMatchConfidence: 0.9 },
    ]);
    expect(r.projectLineId).toBe("10.3.3");
    const [weak] = matchOfferLines(requested, [
      { supplier_reference: null, supplier_designation: "Article divers", quantity: 3, is_fee: false, aiMatchId: "10.2.1", aiMatchConfidence: 0.95 },
    ]);
    expect(weak.status).toBe("unmatched");
  });

  it("utilise l'identifiant exact du fichier de consultation", () => {
    const [r] = matchOfferLines(requested, [
      { supplier_reference: "X", supplier_designation: "n'importe quoi", quantity: null, is_fee: false, exactProjectLineId: "10.2.7" },
    ]);
    expect(r).toMatchObject({ projectLineId: "10.2.7", status: "matched", method: "template" });
  });

  it("signale un doublon possible", () => {
    const res = matchOfferLines(requested, [
      { supplier_reference: null, supplier_designation: "Purgeur automatique d'air", quantity: 16, is_fee: false },
      { supplier_reference: null, supplier_designation: "Purgeur automatique d'air", quantity: 16, is_fee: false },
    ]);
    expect(res[0].projectLineId).toBe("10.2.11");
    expect(res[1].projectLineId).toBeNull();
    expect(res[1].duplicateOf).toBe("10.2.11");
  });
});

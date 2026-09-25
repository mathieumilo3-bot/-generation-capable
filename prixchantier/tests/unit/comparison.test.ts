import { describe, expect, it } from "vitest";
import { computeComparison, type CmpLine, type CmpOffer, type CmpOfferLine, type CmpSupplier } from "@/lib/comparison/compute";

const lines: CmpLine[] = Array.from({ length: 10 }, (_, i) => ({
  id: `L${i + 1}`,
  position: i,
  lot: "LOT 10",
  code: `10.${i + 1}`,
  designation: `Article ${i + 1}`,
  quantity: 10,
  unit: "U",
}));
const ids = lines.map((l) => l.id);

function offerLine(id: string, unitPrice: number, extra: Partial<CmpOfferLine> = {}): CmpOfferLine {
  return {
    id: `ol-${id}-${unitPrice}`,
    projectLineId: id,
    matchStatus: "matched",
    supplierReference: null,
    supplierDesignation: `Article ${id}`,
    quantity: 10,
    unit: "U",
    unitPrice,
    totalPrice: unitPrice * 10,
    discount: null,
    isAlternative: false,
    alternativeNote: null,
    isFee: false,
    confidence: 0.95,
    duplicateOf: null,
    ...extra,
  };
}

function offer(linesIn: CmpOfferLine[], extra: Partial<CmpOffer> = {}): CmpOffer {
  return {
    id: "o",
    quoteReference: null,
    totalHt: null,
    deliveryCost: null,
    deliveryIncluded: "unknown",
    commissioningIncluded: "unknown",
    validityDate: null,
    deliveryDelay: null,
    paymentTerms: null,
    exclusions: [],
    reservations: [],
    confidence: 0.95,
    lines: linesIn,
    ...extra,
  };
}

// A : complet, 428,50 €/ligne → 42 850 €.
const A: CmpSupplier = {
  consultationId: "cA",
  supplierId: "sA",
  name: "Fournisseur A",
  status: "repondu",
  requestedLineIds: ids,
  offer: offer(ids.map((id) => offerLine(id, 428.5))),
};
// B : 3 lignes absentes, mise en service exclue, total annoncé 41 920 €.
const bLines = ids.slice(0, 7).map((id) => offerLine(id, 598.857));
const B: CmpSupplier = {
  consultationId: "cB",
  supplierId: "sB",
  name: "Fournisseur B",
  status: "repondu",
  requestedLineIds: ids,
  offer: offer(bLines, { totalHt: 41920, commissioningIncluded: "no" }),
};
const C: CmpSupplier = { consultationId: "cC", supplierId: "sC", name: "Fournisseur C", status: "envoye", requestedLineIds: ids, offer: null };

describe("comparatif", () => {
  const today = new Date("2026-09-25T10:00:00Z");
  const cmp = computeComparison(lines, [A, B, C], today);

  it("n'annonce jamais « meilleur » quand le périmètre diffère", () => {
    expect(cmp.insights[0]).toBe(
      "Fournisseur B est actuellement 930 € moins cher que Fournisseur A, mais 3 lignes sont absentes et la mise en service semble exclue.",
    );
    expect(cmp.insights.join(" ")).not.toMatch(/meilleur/i);
  });

  it("compare aussi à périmètre identique", () => {
    expect(cmp.insights[1]).toMatch(/^À périmètre identique \(7 lignes chiffrées par tous\), Fournisseur A est le moins cher/);
  });

  it("calcule totaux, couverture et lignes manquantes", () => {
    const a = cmp.suppliers.find((s) => s.name === "Fournisseur A")!;
    const b = cmp.suppliers.find((s) => s.name === "Fournisseur B")!;
    expect(a.total).toBe(42850);
    expect(a.totalSource).toBe("computed");
    expect(a.coverage).toBe(1);
    expect(b.total).toBe(41920);
    expect(b.missingCount).toBe(3);
    expect(b.alerts.map((x) => x.code)).toEqual(expect.arrayContaining(["missing", "commissioning"]));
    expect(cmp.cells.L10.cB).toEqual({ kind: "missing" });
    expect(cmp.cells.L1.cC).toEqual({ kind: "awaiting" });
    expect(cmp.filters.missing).toEqual(["L8", "L9", "L10"]);
  });

  it("marque le prix le plus bas par ligne", () => {
    const l1 = cmp.cells.L1;
    expect(l1.cA.kind === "priced" && l1.cA.isBest).toBe(true);
    expect(l1.cB.kind === "priced" && l1.cB.isBest).toBe(false);
  });

  it("détecte quantités/unités différentes, variantes, frais, livraison, validité et doublons", () => {
    const D: CmpSupplier = {
      consultationId: "cD",
      supplierId: "sD",
      name: "Fournisseur D",
      status: "repondu",
      requestedLineIds: ids.slice(0, 3),
      offer: offer(
        [
          offerLine("L1", 10, { quantity: 12 }),
          offerLine("L2", 10, { unit: "ml" }),
          offerLine("L3", 10, { isAlternative: true, alternativeNote: "équivalent" }),
          { ...offerLine("L3", 10), id: "dup", projectLineId: null, matchStatus: "unmatched", duplicateOf: "L3" },
          { ...offerLine("x", 85), id: "port", projectLineId: null, matchStatus: "unmatched", isFee: true, totalPrice: 85, quantity: 1 },
        ],
        { deliveryIncluded: "no", validityDate: "2026-09-28" },
      ),
    };
    const res = computeComparison(lines, [D], today);
    const d = res.suppliers[0];
    const codes = d.alerts.map((a) => a.code);
    expect(codes).toEqual(expect.arrayContaining(["differences", "alternative", "fees", "delivery", "expiring", "duplicates"]));
    expect(d.feesTotal).toBe(85);
    const c1 = res.cells.L1.cD;
    expect(c1.kind === "priced" && c1.alerts).toContain("qty_diff");
    expect(res.filters.differences).toEqual(["L1", "L2", "L3"]);
    expect(res.insights[0]).toMatch(/^Une seule offre exploitable/);
  });

  it("met en évidence les correspondances à vérifier", () => {
    const E: CmpSupplier = {
      ...A,
      consultationId: "cE",
      offer: offer([offerLine("L1", 5, { matchStatus: "to_verify" })]),
    };
    const res = computeComparison(lines, [E], today);
    expect(res.filters.toVerify).toEqual(["L1"]);
    expect(res.suppliers[0].toVerifyCount).toBe(1);
  });

  it("signale une offre expirée", () => {
    const res = computeComparison(lines, [{ ...A, offer: offer(A.offer!.lines, { validityDate: "2026-09-01" }) }], today);
    expect(res.suppliers[0].alerts.map((a) => a.code)).toContain("expired");
  });
});

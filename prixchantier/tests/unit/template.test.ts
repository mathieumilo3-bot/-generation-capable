import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildConsultationWorkbook, parseFilledTemplate, templateReference } from "@/lib/offers/template";
import { readWorkbook } from "@/lib/parsing/spreadsheet";

const lines = [
  { id: "11111111-1111-4111-8111-111111111111", code: "10.2.1", designation: "Tube acier noir DN20", quantity: 120, unit: "ml" },
  { id: "22222222-2222-4222-8222-222222222222", code: "10.2.2", designation: "Tube acier noir DN25", quantity: 95, unit: "ml" },
  { id: "33333333-3333-4333-8333-333333333333", code: "10.3.3", designation: "Robinet thermostatique avec tête", quantity: 30, unit: "U" },
];

async function build() {
  return buildConsultationWorkbook({
    referenceCode: "PC-ABC123",
    projectName: "Résidence Les Tilleuls",
    organizationName: "Entreprise Test",
    dueDate: "2026-10-05",
    lines,
  });
}

describe("fichier Excel de consultation", () => {
  it("ne contient que les lignes envoyées, avec les colonnes demandées", async () => {
    const buf = await build();
    const wb = readWorkbook(buf, "xlsx");
    const sheet = wb.sheets.find((s) => s.name === "Demande de prix")!;
    expect(sheet.rows[5].slice(0, 8)).toEqual([
      "N°", "Référence", "Désignation", "Quantité", "Unité", "Prix unitaire HT (€)", "Prix total HT (€)", "Commentaire",
    ]);
    expect(sheet.rows.slice(6, 9).map((r) => r[2])).toEqual(lines.map((l) => l.designation));
    expect(sheet.hiddenColumns).toContain(8);
    expect(templateReference(wb)).toBe("PC-ABC123");
  });

  it("relit exactement un fichier rempli par le fournisseur", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await build()) as never);
    const ws = wb.getWorksheet("Demande de prix")!;
    ws.getCell("F7").value = 12.4;
    ws.getCell("F8").value = "15,90"; // saisi en texte à la française
    ws.getCell("H9").value = "Non disponible, équivalent proposé sous 2 semaines";
    ws.getCell("F9").value = 31;
    // Bloc d'informations sous le tableau.
    const findRow = (label: string) => {
      let found = 0;
      ws.eachRow((row, n) => {
        if (String(row.getCell(2).value ?? "").startsWith(label)) found = n;
      });
      return found;
    };
    ws.getCell(`D${findRow("Délai de livraison")}`).value = "2 semaines";
    ws.getCell(`D${findRow("Frais de livraison")}`).value = 65;
    ws.getCell(`D${findRow("Observations")}`).value = "Mise en service non comprise";
    const filled = Buffer.from(await wb.xlsx.writeBuffer());

    const draft = parseFilledTemplate(readWorkbook(filled, "xlsx"), "consultation.xlsx")!;
    expect(draft.referenceCode).toBe("PC-ABC123");
    expect(draft.sourceKind).toBe("template");
    const [l1, l2, l3, fee] = draft.lines;
    expect(l1).toMatchObject({ exactProjectLineId: lines[0].id, unit_price: 12.4, total_price: 1488 });
    expect(l2).toMatchObject({ exactProjectLineId: lines[1].id, unit_price: 15.9 });
    expect(l2.total_price).toBeCloseTo(1510.5, 2);
    expect(l3).toMatchObject({ exactProjectLineId: lines[2].id, unit_price: 31, is_alternative: true });
    expect(fee).toMatchObject({ is_fee: true, total_price: 65 });
    expect(draft.header).toMatchObject({ delivery_delay: "2 semaines", delivery_cost: 65, commissioning_included: "no", delivery_included: "no" });
  });

  it("classe en réponse partielle quand des prix manquent", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await build()) as never);
    wb.getWorksheet("Demande de prix")!.getCell("F7").value = 10;
    const draft = parseFilledTemplate(readWorkbook(Buffer.from(await wb.xlsx.writeBuffer()), "xlsx"), "c.xlsx")!;
    expect(draft.classification).toBe("partial");
  });

  it("ignore un classeur qui n'est pas notre modèle", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Devis").addRow(["Désignation", "Qté"]);
    const draft = parseFilledTemplate(readWorkbook(Buffer.from(await wb.xlsx.writeBuffer()), "xlsx"), "x.xlsx");
    expect(draft).toBeNull();
  });
});

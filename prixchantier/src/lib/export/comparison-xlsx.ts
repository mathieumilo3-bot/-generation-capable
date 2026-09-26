import ExcelJS from "exceljs";
import type { Cell, Comparison } from "@/lib/comparison/compute";
import { CONSULTATION_STATUS } from "@/lib/labels";

const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F3542" } };
const SUB_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9ECEF" } };
const BEST_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9F2E3" } };
const MISSING_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBE0DE" } };
const WARN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD6D6D6" } },
  bottom: { style: "thin", color: { argb: "FFD6D6D6" } },
  left: { style: "thin", color: { argb: "FFD6D6D6" } },
  right: { style: "thin", color: { argb: "FFD6D6D6" } },
};
const EUR = '#,##0.00 "€"';
const YESNO: Record<string, string> = { yes: "Oui", no: "Non", unknown: "Non précisé", not_applicable: "Sans objet" };
const ALERT: Record<string, string> = {
  qty_diff: "Quantité différente",
  unit_diff: "Unité différente",
  alternative: "Variante",
  low_confidence: "Lecture incertaine",
  computed_total: "Total calculé",
};

function styleHeader(row: ExcelJS.Row, from: number, to: number) {
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.fill = HEAD_FILL;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BORDER;
  }
}

function cellNote(cell: Cell): string {
  switch (cell.kind) {
    case "not_requested":
      return "Non demandé";
    case "awaiting":
      return "En attente";
    case "refused":
      return "Refus";
    case "missing":
      return "ABSENTE du devis";
    case "unpriced":
      return `Sans prix${cell.note ? ` — ${cell.note}` : ""}`;
    case "priced": {
      const notes = cell.alerts.map((a) => ALERT[a]);
      if (cell.verify) notes.unshift("Correspondance à vérifier");
      if (cell.alternativeNote) notes.push(cell.alternativeNote);
      return notes.join(" ; ");
    }
  }
}

export async function buildComparisonWorkbook(input: {
  projectName: string;
  projectReference: string | null;
  organizationName: string;
  comparison: Comparison;
}): Promise<Buffer> {
  const { comparison: cmp } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "PrixChantier";
  wb.created = new Date();
  const generated = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  // ---- Synthèse ----------------------------------------------------------
  const syn = wb.addWorksheet("Synthèse", { views: [{ state: "frozen", ySplit: 5 }] });
  syn.getCell("A1").value = `Comparatif fournisseurs — ${input.projectName}${input.projectReference ? ` (${input.projectReference})` : ""}`;
  syn.getCell("A1").font = { bold: true, size: 14 };
  syn.getCell("A2").value = `${input.organizationName} — généré le ${generated}`;
  syn.getCell("A2").font = { color: { argb: "FF666666" } };
  syn.getCell("A3").value = "Montants HT. Les valeurs extraites automatiquement sont à vérifier sur les devis d'origine.";
  syn.getCell("A3").font = { italic: true, color: { argb: "FF666666" } };
  const synHeaders = [
    "Fournisseur", "Statut", "Total HT", "Origine du total", "Lignes chiffrées", "Lignes absentes", "À vérifier", "Variantes",
    "Frais annexes HT", "Délai", "Validité", "Conditions de paiement", "Livraison incluse", "Mise en service incluse", "Points d'attention",
  ];
  const h = syn.getRow(5);
  h.values = synHeaders;
  h.height = 32;
  styleHeader(h, 1, synHeaders.length);
  cmp.suppliers.forEach((s, i) => {
    const row = syn.getRow(6 + i);
    row.values = [
      s.name,
      CONSULTATION_STATUS[s.status]?.label ?? s.status,
      s.total,
      s.totalSource === "stated" ? "Annoncé sur le devis" : s.totalSource === "computed" ? "Somme des lignes" : "—",
      s.hasOffer ? `${s.pricedCount} / ${s.requestedCount}` : "—",
      s.hasOffer ? s.missingCount : null,
      s.hasOffer ? s.toVerifyCount : null,
      s.hasOffer ? s.alternativeCount : null,
      s.hasOffer ? s.feesTotal + (s.offer?.deliveryCost && !s.feesTotal ? s.offer.deliveryCost : 0) : null,
      s.offer?.deliveryDelay ?? "",
      s.offer?.validityDate ? new Date(`${s.offer.validityDate}T12:00:00Z`) : "",
      s.offer?.paymentTerms ?? "",
      s.offer ? YESNO[s.offer.deliveryIncluded] : "",
      s.offer ? YESNO[s.offer.commissioningIncluded] : "",
      s.alerts.map((a) => a.message).join("\n"),
    ];
    row.getCell(3).numFmt = EUR;
    row.getCell(9).numFmt = EUR;
    row.getCell(11).numFmt = "dd/mm/yyyy";
    row.getCell(15).alignment = { wrapText: true, vertical: "top" };
    row.alignment = { vertical: "top" };
    for (let c = 1; c <= synHeaders.length; c++) row.getCell(c).border = BORDER;
    if (s.missingCount) row.getCell(6).fill = MISSING_FILL;
    if (s.toVerifyCount) row.getCell(7).fill = WARN_FILL;
  });
  syn.columns.forEach((col, i) => (col.width = [28, 16, 16, 20, 14, 14, 11, 11, 15, 22, 12, 24, 14, 16, 60][i] ?? 14));
  let r = 7 + cmp.suppliers.length;
  syn.getCell(`A${r}`).value = "Analyse";
  syn.getCell(`A${r}`).font = { bold: true };
  for (const text of cmp.insights) {
    r++;
    syn.getCell(`A${r}`).value = text;
    syn.mergeCells(`A${r}:O${r}`);
    syn.getCell(`A${r}`).alignment = { wrapText: true };
  }

  // ---- Comparatif ligne à ligne -----------------------------------------
  const ws = wb.addWorksheet("Comparatif", { views: [{ state: "frozen", xSplit: 5, ySplit: 2 }] });
  const fixed = ["Lot", "Réf.", "Désignation", "Qté", "Unité"];
  const top = ws.getRow(1);
  const sub = ws.getRow(2);
  fixed.forEach((label, i) => {
    top.getCell(i + 1).value = label;
    ws.mergeCells(1, i + 1, 2, i + 1);
  });
  cmp.suppliers.forEach((s, i) => {
    const c = 6 + i * 3;
    top.getCell(c).value = s.name;
    ws.mergeCells(1, c, 1, c + 2);
    sub.getCell(c).value = "PU HT";
    sub.getCell(c + 1).value = "Total HT";
    sub.getCell(c + 2).value = "Observations";
  });
  const lastCol = 5 + cmp.suppliers.length * 3;
  styleHeader(top, 1, lastCol);
  styleHeader(sub, 1, lastCol);
  for (let c = 6; c <= lastCol; c++) {
    sub.getCell(c).fill = SUB_FILL;
    sub.getCell(c).font = { bold: true, color: { argb: "FF333333" } };
  }
  cmp.lines.forEach((l, i) => {
    const row = ws.getRow(3 + i);
    row.getCell(1).value = l.lot ?? "";
    row.getCell(2).value = l.code ?? "";
    row.getCell(3).value = l.designation;
    row.getCell(4).value = l.quantity;
    row.getCell(5).value = l.unit ?? "";
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
    row.getCell(4).numFmt = "#,##0.###";
    cmp.suppliers.forEach((s, j) => {
      const c = 6 + j * 3;
      const cell = cmp.cells[l.id][s.consultationId];
      if (cell.kind === "priced") {
        row.getCell(c).value = cell.unitPrice;
        row.getCell(c + 1).value = cell.total;
        if (cell.isBest && cmp.suppliers.filter((x) => x.hasOffer).length > 1) {
          row.getCell(c).fill = BEST_FILL;
          row.getCell(c + 1).fill = BEST_FILL;
        }
        if (cell.verify || cell.alerts.some((a) => a !== "computed_total")) row.getCell(c + 2).fill = WARN_FILL;
      } else if (cell.kind === "missing" || cell.kind === "unpriced") {
        for (const k of [c, c + 1, c + 2]) row.getCell(k).fill = MISSING_FILL;
      }
      row.getCell(c).numFmt = EUR;
      row.getCell(c + 1).numFmt = EUR;
      row.getCell(c + 2).value = cellNote(cell);
      row.getCell(c + 2).alignment = { wrapText: true, vertical: "top" };
    });
    for (let c = 1; c <= lastCol; c++) row.getCell(c).border = BORDER;
  });
  const first = 3;
  const last = 2 + cmp.lines.length;
  const sumRow = ws.getRow(last + 1);
  const statedRow = ws.getRow(last + 2);
  sumRow.getCell(3).value = "Somme des lignes chiffrées";
  statedRow.getCell(3).value = "Total de l'offre HT (annoncé ou calculé, frais inclus)";
  cmp.suppliers.forEach((s, j) => {
    const c = 6 + j * 3 + 1;
    const col = ws.getColumn(c).letter;
    sumRow.getCell(c).value = cmp.lines.length ? { formula: `SUM(${col}${first}:${col}${last})`, result: s.linesTotal } : 0;
    statedRow.getCell(c).value = s.total;
    sumRow.getCell(c).numFmt = statedRow.getCell(c).numFmt = EUR;
  });
  for (const row of [sumRow, statedRow]) {
    row.font = { bold: true };
    for (let c = 1; c <= lastCol; c++) row.getCell(c).border = BORDER;
  }
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 55;
  ws.getColumn(4).width = 9;
  ws.getColumn(5).width = 8;
  cmp.suppliers.forEach((_, j) => {
    ws.getColumn(6 + j * 3).width = 13;
    ws.getColumn(7 + j * 3).width = 15;
    ws.getColumn(8 + j * 3).width = 26;
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: lastCol } };

  // ---- Lignes manquantes -------------------------------------------------
  const miss = wb.addWorksheet("Lignes manquantes", { views: [{ state: "frozen", ySplit: 1 }] });
  miss.getRow(1).values = ["Fournisseur", "Réf.", "Désignation", "Qté", "Unité"];
  styleHeader(miss.getRow(1), 1, 5);
  let m = 2;
  for (const s of cmp.suppliers.filter((x) => x.hasOffer)) {
    for (const l of cmp.lines) {
      const cell = cmp.cells[l.id][s.consultationId];
      if (cell.kind !== "missing" && cell.kind !== "unpriced") continue;
      miss.getRow(m++).values = [s.name, l.code ?? "", l.designation, l.quantity, l.unit ?? ""];
    }
  }
  if (m === 2) miss.getRow(2).values = ["Aucune ligne manquante dans les offres reçues."];
  miss.columns.forEach((col, i) => (col.width = [28, 10, 60, 9, 8][i]));

  // ---- Commentaires ------------------------------------------------------
  const com = wb.addWorksheet("Commentaires");
  com.getRow(1).values = ["Fournisseur", "Réf. devis", "Exclusions", "Réserves", "Lignes du devis non rattachées"];
  styleHeader(com.getRow(1), 1, 5);
  cmp.suppliers
    .filter((s) => s.offer)
    .forEach((s, i) => {
      const unmatched = s.offer!.lines.filter((l) => !l.projectLineId && l.matchStatus !== "user_rejected");
      const row = com.getRow(2 + i);
      row.values = [
        s.name,
        s.offer!.quoteReference ?? "",
        s.offer!.exclusions.join("\n"),
        s.offer!.reservations.join("\n"),
        unmatched.map((l) => `${l.supplierDesignation ?? ""} — ${l.totalPrice ?? l.unitPrice ?? "?"} €${l.isFee ? " (frais)" : ""}`).join("\n"),
      ];
      row.alignment = { wrapText: true, vertical: "top" };
    });
  com.columns.forEach((col, i) => (col.width = [28, 18, 50, 40, 60][i]));

  return Buffer.from(await wb.xlsx.writeBuffer());
}

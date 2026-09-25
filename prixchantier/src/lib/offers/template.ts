import ExcelJS from "exceljs";
import type { Workbook } from "@/lib/parsing/spreadsheet";
import { cellText, normalizeText, parseNumber } from "@/lib/parsing/normalize";
import type { OfferDraft, DraftLine } from "./draft";

/**
 * Fichier Excel joint à chaque consultation : uniquement les lignes envoyées.
 * Une colonne masquée porte l'identifiant stable de chaque ligne, et une
 * feuille masquée la référence de consultation : si le fournisseur remplit
 * ce fichier, la lecture est exacte (aucune IA, aucun rapprochement approximatif).
 */

export const TEMPLATE_SHEET = "Demande de prix";
export const META_SHEET = "_prixchantier";
const HEADERS = ["N°", "Référence", "Désignation", "Quantité", "Unité", "Prix unitaire HT (€)", "Prix total HT (€)", "Commentaire", "ID"];
const INFO_LABELS = {
  delivery_delay: "Délai de livraison",
  validity: "Validité de l'offre",
  delivery_cost: "Frais de livraison HT (€)",
  payment_terms: "Conditions de paiement",
  comments: "Observations / exclusions",
} as const;

export type TemplateLine = { id: string; code: string | null; designation: string; quantity: number | null; unit: string | null };

export async function buildConsultationWorkbook(input: {
  referenceCode: string;
  projectName: string;
  organizationName: string;
  dueDate: string | null;
  lines: TemplateLine[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = input.organizationName;
  const ws = wb.addWorksheet(TEMPLATE_SHEET, { views: [{ state: "frozen", ySplit: 6 }] });
  ws.columns = [
    { width: 6 },
    { width: 14 },
    { width: 60 },
    { width: 11 },
    { width: 9 },
    { width: 18 },
    { width: 18 },
    { width: 36 },
    { width: 38, hidden: true },
  ];
  ws.getCell("A1").value = `Demande de prix — ${input.projectName}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = `Référence consultation : ${input.referenceCode}`;
  ws.getCell("A3").value = `Demandeur : ${input.organizationName}`;
  if (input.dueDate) ws.getCell("A4").value = `Retour souhaité avant le : ${input.dueDate.split("-").reverse().join("/")}`;
  ws.getCell("A2").font = ws.getCell("A3").font = ws.getCell("A4").font = { color: { argb: "FF555555" } };

  const header = ws.getRow(6);
  header.values = HEADERS;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  for (let c = 1; c <= 8; c++) {
    header.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F3542" } };
  }

  const inputFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8DC" } };
  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD0D0D0" } },
    bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
    left: { style: "thin", color: { argb: "FFD0D0D0" } },
    right: { style: "thin", color: { argb: "FFD0D0D0" } },
  };
  const first = 7;
  input.lines.forEach((l, i) => {
    const r = first + i;
    const row = ws.getRow(r);
    row.values = [i + 1, l.code ?? "", l.designation, l.quantity ?? "", l.unit ?? "", null, null, null, l.id];
    row.getCell(7).value = { formula: `IF(F${r}="","",D${r}*F${r})` };
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
    row.getCell(4).numFmt = "#,##0.###";
    row.getCell(6).numFmt = row.getCell(7).numFmt = "#,##0.00";
    for (const c of [6, 8]) row.getCell(c).fill = inputFill;
    for (let c = 1; c <= 8; c++) row.getCell(c).border = border;
  });
  const last = first + input.lines.length - 1;
  const totalRow = ws.getRow(last + 1);
  totalRow.getCell(3).value = "Total HT";
  totalRow.getCell(3).font = { bold: true };
  totalRow.getCell(7).value = { formula: `SUM(G${first}:G${last})` };
  totalRow.getCell(7).numFmt = "#,##0.00";
  totalRow.getCell(7).font = { bold: true };

  let r = last + 3;
  for (const label of Object.values(INFO_LABELS)) {
    ws.getCell(`B${r}`).value = `${label} :`;
    ws.mergeCells(`B${r}:C${r}`);
    ws.getCell(`B${r}`).alignment = { horizontal: "right" };
    ws.getCell(`D${r}`).fill = inputFill;
    ws.mergeCells(`D${r}:H${r}`);
    r++;
  }
  ws.getCell(`B${r + 1}`).value =
    "Vous pouvez remplir ce fichier, ou répondre avec votre propre devis (PDF / Excel) : les deux conviennent.";
  ws.getCell(`B${r + 1}`).font = { italic: true, color: { argb: "FF777777" } };

  const meta = wb.addWorksheet(META_SHEET, { state: "veryHidden" });
  meta.addRow(["reference_code", input.referenceCode]);
  meta.addRow(["version", 1]);
  meta.addRow(["first_row", first]);
  input.lines.forEach((l, i) => meta.addRow([`line_${i + 1}`, l.id]));

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Référence de consultation si le classeur est notre fichier de consultation. */
export function templateReference(wb: Workbook): string | null {
  const meta = wb.sheets.find((s) => s.name === META_SHEET);
  const ref = meta?.rows.find((r) => r[0] === "reference_code")?.[1];
  return typeof ref === "string" && /^PC-[A-Z0-9]{6}$/.test(ref) ? ref : null;
}

/**
 * Lit notre fichier de consultation rempli par le fournisseur.
 * Renvoie null si ce n'est pas notre modèle (le fichier suit alors le chemin
 * d'extraction générique).
 */
export function parseFilledTemplate(wb: Workbook, fileName: string): (OfferDraft & { referenceCode: string }) | null {
  const referenceCode = templateReference(wb);
  const sheet = wb.sheets.find((s) => s.name === TEMPLATE_SHEET);
  if (!referenceCode || !sheet) return null;
  const meta = wb.sheets.find((s) => s.name === META_SHEET)!;
  const byPosition = new Map<number, string>();
  for (const row of meta.rows) {
    const m = /^line_(\d+)$/.exec(String(row[0] ?? ""));
    if (m && typeof row[1] === "string") byPosition.set(Number(m[1]), row[1]);
  }

  const headerIdx = sheet.rows.findIndex((row) => normalizeText(row[2]) === "designation" && normalizeText(row[5]).startsWith("prix unitaire"));
  if (headerIdx < 0) return null;

  const lines: DraftLine[] = [];
  const info: Partial<Record<keyof typeof INFO_LABELS, string>> = {};
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  for (let r = headerIdx + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] ?? [];
    const label = normalizeText(row[1]);
    for (const [key, text] of Object.entries(INFO_LABELS) as [keyof typeof INFO_LABELS, string][]) {
      if (label.startsWith(normalizeText(text))) {
        const value = cellText(row[3]);
        if (value) info[key] = value;
      }
    }
    const idCell = cellText(row[8]);
    const position = parseNumber(row[0]);
    const id = uuid.test(idCell) ? idCell : position !== null ? byPosition.get(position) : undefined;
    if (!id) continue;
    const unitPrice = parseNumber(row[5]);
    const totalCell = parseNumber(row[6]);
    const quantity = parseNumber(row[3]);
    const comment = cellText(row[7]) || null;
    const priceText = typeof row[5] === "string" ? row[5].trim() : "";
    lines.push({
      supplier_reference: cellText(row[1]) || null,
      supplier_designation: cellText(row[2]),
      quantity,
      unit: cellText(row[4]) || null,
      unit_price: unitPrice,
      total_price: totalCell ?? (unitPrice !== null && quantity !== null ? Math.round(unitPrice * quantity * 100) / 100 : null),
      discount: null,
      availability: null,
      delivery_delay: null,
      is_alternative: Boolean(comment && /variante|equivalent|équivalent|alternati|remplac/i.test(comment)),
      alternative_note: comment ?? (priceText && unitPrice === null ? priceText : null),
      is_fee: false,
      confidence: unitPrice !== null || totalCell !== null ? 0.98 : 0.9,
      source: { file: fileName, sheet: TEMPLATE_SHEET, row: r + 1, page: null },
      exactProjectLineId: id,
      aiMatchKey: null,
      aiMatchConfidence: null,
    });
  }

  const deliveryCost = parseNumber(info.delivery_cost ?? null);
  const priced = lines.filter((l) => l.unit_price !== null || l.total_price !== null);
  if (deliveryCost) {
    lines.push({
      supplier_reference: null,
      supplier_designation: "Frais de livraison",
      quantity: 1,
      unit: "forfait",
      unit_price: deliveryCost,
      total_price: deliveryCost,
      discount: null,
      availability: null,
      delivery_delay: null,
      is_alternative: false,
      alternative_note: null,
      is_fee: true,
      confidence: 0.95,
      source: { file: fileName, sheet: TEMPLATE_SHEET, row: null, page: null },
      exactProjectLineId: null,
      aiMatchKey: null,
      aiMatchConfidence: null,
    });
  }
  const comments = info.comments ?? null;
  return {
    referenceCode,
    sourceKind: "template",
    classification: priced.length === 0 ? "other" : priced.length < lines.filter((l) => !l.is_fee).length ? "partial" : "offer",
    header: {
      quote_reference: null,
      quote_date: null,
      validity_date: null,
      validity_text: info.validity ?? null,
      delivery_delay: info.delivery_delay ?? null,
      payment_terms: info.payment_terms ?? null,
      delivery_cost: deliveryCost,
      delivery_included: deliveryCost ? "no" : "unknown",
      commissioning_included: comments && /mise en service (non|exclue|hors)|hors mise en service/i.test(comments) ? "no" : "unknown",
      total_ht: null,
      currency: "EUR",
      exclusions: comments ? [comments] : [],
      reservations: [],
      comments,
    },
    confidence: 0.98,
    extraction: { method: "template", fields: info },
    lines,
  };
}

/**
 * Génère les fixtures documentaires anonymisées utilisées par les tests.
 *   npx tsx scripts/generate-fixtures.ts
 * Le PDF scanné est produit par scripts/make-scanned-pdf.py (Pillow) et le
 * XLS par LibreOffice (conversion de dpgf-standard.xlsx).
 */
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "@e965/xlsx";
import { join } from "node:path";
import { DPGF_LOTS, ALL_LINES } from "../tests/fixtures/data";

const OUT = join(process.cwd(), "tests/fixtures/files");

async function dpgfStandard() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("DPGF");
  ws.addRow(["Résidence Les Tilleuls — Construction de 24 logements"]);
  ws.addRow(["Décomposition du Prix Global et Forfaitaire"]);
  ws.addRow(["Maître d'ouvrage : SCI Anonyme"]);
  ws.addRow([]);
  ws.addRow([]);
  ws.addRow(["N°", "Désignation", "U", "Qté", "P.U. HT", "Montant HT"]);
  for (const lot of DPGF_LOTS) {
    ws.addRow(["", lot.lot]);
    for (const section of lot.sections) {
      ws.addRow(["", section.title]);
      section.lines.forEach((l, i) => {
        ws.addRow([l.code, l.designation, l.unit, l.qty, null, null]);
        if (i === 0) ws.addRow(["", "y compris raccordements, accessoires et toutes sujétions"]);
      });
      ws.addRow(["", `Sous-total ${section.title.split(" ")[0]}`, "", "", "", null]);
    }
    ws.addRow(["", `Total ${lot.lot.split(" - ")[0]} HT`, "", "", "", null]);
  }
  ws.addRow([]);
  ws.addRow(["", "TOTAL GÉNÉRAL HT"]);
  ws.addRow(["", "TVA 20 %"]);
  ws.getColumn(2).width = 70;
  await wb.xlsx.writeFile(join(OUT, "dpgf-standard.xlsx"));
}

async function dpgfMultiSheets() {
  const wb = new ExcelJS.Workbook();
  const garde = wb.addWorksheet("Page de garde");
  garde.addRow(["Groupe scolaire — Réhabilitation"]);
  garde.addRow(["DPGF lots techniques"]);
  garde.addRow(["Indice B — mars"]);
  for (const lot of DPGF_LOTS) {
    const ws = wb.addWorksheet(lot.lot.split(" - ")[0] + " " + lot.lot.split(" - ")[1].split(" ")[0]);
    ws.addRow([lot.lot]);
    ws.addRow([]);
    ws.addRow(["Réf.", "Libellé", "Quantité", "Unité", "PU", "Total"]);
    for (const section of lot.sections) {
      ws.addRow([section.title.split(" ")[0], section.title.split(" ").slice(1).join(" ")]);
      for (const l of section.lines) ws.addRow([l.code, l.designation, l.qty, l.unit, null, null]);
    }
  }
  const recap = wb.addWorksheet("Récapitulatif");
  recap.addRow(["Lot", "Montant HT"]);
  for (const lot of DPGF_LOTS) recap.addRow([lot.lot, null]);
  const hidden = wb.addWorksheet("Paramètres");
  hidden.state = "hidden";
  hidden.addRow(["Désignation", "Qté", "U"]);
  hidden.addRow(["Ligne technique masquée", 1, "U"]);
  await wb.xlsx.writeFile(join(OUT, "dpgf-multi-onglets.xlsx"));
}

async function dpgfMerged() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lot 10");
  ws.getCell("A1").value = "LOT 10 — CVC";
  ws.mergeCells("A1:H1");
  ws.getCell("A6").value = "N°";
  ws.mergeCells("A6:A7");
  ws.getCell("B6").value = "Désignation des ouvrages";
  ws.mergeCells("B6:D7");
  ws.getCell("E6").value = "Unité";
  ws.mergeCells("E6:E7");
  ws.getCell("F6").value = "Quantité";
  ws.mergeCells("F6:F7");
  ws.getCell("G6").value = "Prix unitaire";
  ws.mergeCells("G6:G7");
  ws.getCell("H6").value = "Montant";
  ws.mergeCells("H6:H7");
  let r = 8;
  const lot = DPGF_LOTS[0];
  for (const section of lot.sections) {
    ws.getCell(`A${r}`).value = section.title;
    ws.mergeCells(`A${r}:H${r}`);
    r++;
    for (const l of section.lines) {
      ws.getCell(`A${r}`).value = l.code;
      ws.getCell(`B${r}`).value = l.designation;
      ws.mergeCells(`B${r}:D${r}`);
      ws.getCell(`E${r}`).value = l.unit;
      ws.getCell(`F${r}`).value = l.qty;
      r++;
    }
  }
  await wb.xlsx.writeFile(join(OUT, "dpgf-cellules-fusionnees.xlsx"));
}

function dpgfCsv() {
  const lot = DPGF_LOTS[1];
  const rows = ["Code;Désignation;Unité;Quantité"];
  for (const s of lot.sections) {
    rows.push(`;${s.title};;`);
    for (const l of s.lines) rows.push(`${l.code};"${l.designation}";${l.unit};${String(l.qty).replace(".", ",")}`);
  }
  // Export Excel français typique : Windows-1252.
  const text = rows.join("\r\n");
  const bytes = Buffer.from(
    Array.from(text).map((ch) => {
      const map: Record<string, number> = { "é": 0xe9, "è": 0xe8, "ê": 0xea, "à": 0xe0, "É": 0xc9, "ô": 0xf4, "ç": 0xe7, "°": 0xb0, "²": 0xb2, "Ø": 0xd8, "û": 0xfb, "î": 0xee };
      return map[ch] ?? ch.charCodeAt(0);
    }),
  );
  writeFileSync(join(OUT, "dpgf-lot11.csv"), bytes);
}

/** Lignes consultées dans les devis de test : sections 10.2 et 10.3. */
export const CONSULTED = [...DPGF_LOTS[0].sections[1].lines, ...DPGF_LOTS[0].sections[2].lines];

type QuoteLine = { ref: string; label: string; qty: number; unit: string; pu: number };

async function quotePdf(file: string, header: string[], lines: QuoteLine[], footer: string[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const text = (t: string, x: number, size = 9, f = font) => page.drawText(t, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  header.forEach((h, i) => {
    text(h, 40, i === 0 ? 14 : 9, i === 0 ? bold : font);
    y -= i === 0 ? 22 : 13;
  });
  y -= 10;
  const cols = [40, 110, 380, 420, 460, 520];
  ["Réf.", "Désignation", "Qté", "U", "PU HT", "Total HT"].forEach((h, i) => text(h, cols[i], 9, bold));
  y -= 16;
  let total = 0;
  for (const l of lines) {
    if (y < 80) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    const lt = Math.round(l.qty * l.pu * 100) / 100;
    total += lt;
    text(l.ref, cols[0], 8);
    text(l.label.slice(0, 55), cols[1], 8);
    text(String(l.qty).replace(".", ","), cols[2], 8);
    text(l.unit, cols[3], 8);
    text(l.pu.toFixed(2).replace(".", ","), cols[4], 8);
    text(lt.toFixed(2).replace(".", ","), cols[5], 8);
    y -= 13;
  }
  y -= 10;
  text(`Total HT : ${total.toFixed(2).replace(".", ",")} EUR`, 380, 10, bold);
  y -= 20;
  for (const f of footer) {
    text(f, 40, 8);
    y -= 12;
  }
  writeFileSync(join(OUT, file), await pdf.save());
  return Math.round(total * 100) / 100;
}

async function quotes() {
  // Fournisseur A : devis PDF complet, références fournisseur propres.
  const a: QuoteLine[] = CONSULTED.map((l, i) => ({
    ref: `FA${(48210 + i * 7).toString()}`,
    label: l.designation.replace("y compris supports", "").replace("Tube", "Tube").trim(),
    qty: l.qty,
    unit: l.unit === "U" ? "PCE" : l.unit.toUpperCase(),
    pu: Math.round((8 + i * 13.37) * 100) / 100,
  }));
  await quotePdf(
    "devis-fournisseur-a.pdf",
    ["Fournisseur A — Négoce Chauffage Sanitaire", "Devis n° DV-2026-10452 du 12/09/2026", "Validité : 30 jours", "Chantier : Résidence Les Tilleuls"],
    a,
    ["Délai de livraison : 3 semaines après commande", "Franco de port à partir de 1 500 EUR HT", "Conditions de paiement : 45 jours fin de mois", "Mise en service non comprise"],
  );

  // Fournisseur incomplet : moitié des lignes, livraison non incluse.
  const inc = a.slice(0, Math.ceil(a.length / 2)).map((l) => ({ ...l, ref: l.ref.replace("FA", "FI"), pu: Math.round(l.pu * 0.93 * 100) / 100 }));
  await quotePdf(
    "devis-incomplet.pdf",
    ["Fournisseur I — Distribution Thermique", "Offre OF-88213 du 14/09/2026", "Offre valable jusqu'au 30/09/2026"],
    inc,
    ["Livraison non incluse (transport facturé en sus selon zone)", "Délai : 5 semaines"],
  );

  // Fournisseur B : Excel au format propre, 2 lignes manquantes, 1 variante, frais de port.
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Devis");
  ws.addRow(["FOURNISSEUR B — Climatique Services"]);
  ws.addRow(["Devis N° : B-2026-3318", "", "Date : 15/09/2026"]);
  ws.addRow(["Validité de l'offre : 60 jours"]);
  ws.addRow([]);
  ws.addRow(["Article", "Libellé article", "Qté", "U", "Prix net HT", "Remise", "Montant HT"]);
  CONSULTED.forEach((l, i) => {
    if (i === 3 || i === 9) return; // lignes absentes
    let label = l.designation;
    let note = "";
    if (l.code === "10.3.1") {
      label = "VARIANTE : Radiateur acier panneau type 21 H600 L800 (au lieu de type 22)";
      note = "variante";
    }
    const pu = Math.round((7.5 + i * 12.9) * 100) / 100;
    ws.addRow([`B-${7700 + i}`, label, l.qty, l.unit, pu, note ? "" : "35%", Math.round(pu * l.qty * 100) / 100]);
  });
  ws.addRow(["PORT", "Frais de port et emballage", 1, "U", 85, "", 85]);
  ws.addRow([]);
  ws.addRow(["", "Délai : 2 à 3 semaines"]);
  ws.addRow(["", "Mise en service non comprise — Calorifuge hors fourniture"]);
  await wb.xlsx.writeFile(join(OUT, "devis-fournisseur-b.xlsx"));

  // Devis sans références identiques : désignations reformulées, pas de codes.
  const wb2 = new ExcelJS.Workbook();
  const ws2 = wb2.addWorksheet("Offre");
  ws2.addRow(["Désignation", "Quantité", "Unité", "Prix unitaire", "Prix total"]);
  const reworded: Record<string, string> = {
    "10.2.1": "Acier noir tarif 20 (3/4) + colliers",
    "10.2.5": "Multicouche Ø16 gainé couronne",
    "10.3.3": "Tête thermostatique + corps de robinet",
    "10.3.4": "Cassette ventilo 4T 2.5kW",
  };
  CONSULTED.forEach((l, i) => {
    const label = reworded[l.code] ?? l.designation.toLowerCase();
    const pu = Math.round((9 + i * 11.1) * 100) / 100;
    ws2.addRow([label, l.qty, l.unit, pu, Math.round(pu * l.qty * 100) / 100]);
  });
  await wb2.xlsx.writeFile(join(OUT, "devis-sans-references.xlsx"));

  // Texte du devis scanné (rendu en image par make-scanned-pdf.py).
  const scanned = a.slice(0, 8).map((l) => `${l.ref}  ${l.label.slice(0, 40)}  ${l.qty} ${l.unit}  ${l.pu.toFixed(2)}`);
  writeFileSync(join(OUT, "devis-scanne.txt"), ["Fournisseur S - Devis 5521", ...scanned, "Validite 30 jours"].join("\n"));
}

async function main() {
  await dpgfStandard();
  await dpgfMultiSheets();
  await dpgfMerged();
  dpgfCsv();
  // XLS (Excel 97-2003, BIFF8) à partir du DPGF standard.
  const legacy = XLSX.read(readFileSync(join(OUT, "dpgf-standard.xlsx")), { type: "buffer" });
  writeFileSync(join(OUT, "dpgf-legacy.xls"), XLSX.write(legacy, { type: "buffer", bookType: "biff8" }));
  await quotes();
  console.log(`Fixtures générées dans ${OUT} (${ALL_LINES.length} lignes DPGF).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import type { Sheet, Workbook } from "./spreadsheet";
import {
  cellText,
  looksLikeUnit,
  normalizeText,
  normalizeUnit,
  parseNumber,
  type Cell,
} from "./normalize";

/**
 * Extraction déterministe des lignes d'un DPGF / BPU / DQE tabulaire.
 *
 * L'IA n'intervient PAS ici : la structure (références, désignations,
 * quantités, unités) est lue telle quelle, avec la position exacte de chaque
 * ligne (feuille + numéro de ligne Excel). L'IA ne sert ensuite qu'à
 * classer les lignes (famille d'achat, consultation, sous-traitance), et à
 * extraire les documents non tabulaires (PDF).
 */

export type Role = "code" | "designation" | "description" | "quantity" | "unit" | "unitPrice" | "total";

export type ParsedLine = {
  sourceSheet: string | null;
  sourceRow: number | null;
  sourcePage: number | null;
  lot: string | null;
  code: string | null;
  designation: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  flags: string[];
  original: {
    lot: string | null;
    section: string | null;
    code: string | null;
    designation: string;
    quantity: string | number | null;
    unit: string | null;
  };
};

export type SheetReport = {
  name: string;
  status: "parsed" | "skipped";
  reason?: string;
  headerRow?: number;
  columns?: Partial<Record<Role, number>>;
  lines: number;
  ignoredTotals: number;
  unreadableRows: number[];
};

export type DpgfResult = { lines: ParsedLine[]; sheets: SheetReport[] };

const ROLE_PATTERNS: [Role, RegExp][] = [
  ["designation", /^(designation|libelle|intitule|prestations?|nature des (travaux|ouvrages|prestations)|ouvrages?|localisation et designation|designation des (ouvrages|travaux|prestations))\b/],
  ["description", /^(description|descriptif|observations?|caracteristiques|localisation|commentaires?)\b/],
  ["quantity", /^(q|qt|qte|qtes|quantite|quantites|quant|nombre|nb|nbre|qte prevue|qte estimee)\b/],
  ["unit", /^(u|u\.|un|unite|unites|unit)$/],
  ["unitPrice", /^(pu|p\.u\.?|p u|prix unitaire|prix unit|prix u|pu ht|p\.u\. ht)\b/],
  ["total", /^(montant|total|prix total|pt|p\.t\.?|montant ht|total ht|prix global)\b/],
  ["code", /^(n|no|n o|num|numero|ref|ref\.|reference|refs|art|art\.|article|code|poste|item|repere|rep|index|chapitre|id|cctp)\b/],
];

const TOTAL_ROW = /^(sous ?-? ?total|total|montant (total|ht|ttc|du lot|global)|report|a reporter|tva|net a payer|prix global|recapitulatif|total general|total lot)\b/;

function roleOf(value: Cell | undefined): Role | null {
  const text = normalizeText(value);
  if (!text || text.length > 45) return null;
  for (const [role, re] of ROLE_PATTERNS) if (re.test(text)) return role;
  return null;
}

function detectHeader(sheet: Sheet): { row: number; columns: Partial<Record<Role, number>> } | null {
  let best: { row: number; columns: Partial<Record<Role, number>>; score: number } | null = null;
  const limit = Math.min(sheet.rows.length, 40);
  for (let r = 0; r < limit; r++) {
    const row = sheet.rows[r] ?? [];
    const columns: Partial<Record<Role, number>> = {};
    row.forEach((cell, c) => {
      const role = roleOf(cell);
      if (role && columns[role] === undefined) columns[role] = c;
    });
    if (columns.designation === undefined && columns.description !== undefined) {
      columns.designation = columns.description;
      delete columns.description;
    }
    const valid = columns.designation !== undefined && (columns.quantity !== undefined || columns.unit !== undefined);
    if (!valid) continue;
    const score = Object.keys(columns).length;
    if (!best || score > best.score) best = { row: r, columns, score };
  }
  return best ? { row: best.row, columns: best.columns } : null;
}

function isHeaderRepeat(row: Cell[], columns: Partial<Record<Role, number>>) {
  let hits = 0;
  for (const [role, col] of Object.entries(columns)) {
    if (col !== undefined && roleOf(row[col]) === role) hits++;
  }
  return hits >= 2;
}

function lineConfidence(l: { code: string | null; quantity: number | null; unit: string | null; designation: string }) {
  if (l.designation.length < 4) return 0.5;
  if (l.quantity === null) return 0.6;
  let c = 0.97;
  if (!l.code) c -= 0.05;
  if (!l.unit) c -= 0.15;
  return Math.round(c * 100) / 100;
}

export function parseDpgf(wb: Workbook): DpgfResult {
  const lines: ParsedLine[] = [];
  const reports: SheetReport[] = [];
  const visibleSheets = wb.sheets.filter((s) => !s.hidden);
  const multiSheet = visibleSheets.length > 1;

  for (const sheet of wb.sheets) {
    const report: SheetReport = { name: sheet.name, status: "skipped", lines: 0, ignoredTotals: 0, unreadableRows: [] };
    reports.push(report);
    if (sheet.hidden) {
      report.reason = "Feuille masquée";
      continue;
    }
    const header = detectHeader(sheet);
    if (!header) {
      report.reason = "Aucun tableau reconnu (colonnes Désignation / Quantité / Unité introuvables)";
      continue;
    }
    report.status = "parsed";
    report.headerRow = header.row + 1;
    report.columns = header.columns;
    const col = header.columns;

    // Intitulé « LOT … » placé au-dessus de l'en-tête (cartouche de l'onglet).
    let lot: string | null = null;
    for (let r = 0; r < header.row && !lot; r++) {
      for (const cell of sheet.rows[r] ?? []) {
        const text = cellText(cell);
        if (/^lot\b/.test(normalizeText(text))) {
          lot = text;
          break;
        }
      }
    }
    lot ??= multiSheet ? sheet.name : null;
    let section: string | null = null;
    let previous: ParsedLine | null = null;

    for (let r = header.row + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r] ?? [];
      if (row.every((c) => c === null || c === "")) {
        previous = null;
        continue;
      }
      if (isHeaderRepeat(row, col)) continue;

      let code = col.code !== undefined ? cellText(row[col.code]) || null : null;
      let designation = cellText(row[col.designation!]);
      const description = col.description !== undefined ? cellText(row[col.description]) || null : null;
      const qtyRaw = col.quantity !== undefined ? row[col.quantity] : null;
      const unitRaw = col.unit !== undefined ? cellText(row[col.unit]) || null : null;
      const quantity = parseNumber(qtyRaw);
      const qtyText = typeof qtyRaw === "string" ? qtyRaw.trim() : "";

      // Titres saisis dans la colonne référence (fréquent dans les DPGF).
      if (!designation && code && code.length > 12 && !/^[\d.\s-]+$/.test(code)) {
        designation = code;
        code = null;
      }
      if (!designation) {
        if (quantity !== null || unitRaw) report.unreadableRows.push(r + 1);
        continue;
      }

      const normalized = normalizeText(designation);
      if (TOTAL_ROW.test(normalized) || TOTAL_ROW.test(normalizeText(code))) {
        report.ignoredTotals++;
        previous = null;
        continue;
      }

      const isItem = quantity !== null || (unitRaw !== null && looksLikeUnit(unitRaw)) || (qtyText !== "" && qtyText.length <= 10);

      if (isItem) {
        const unit = normalizeUnit(unitRaw);
        const flags: string[] = [];
        if (quantity === null) flags.push(qtyText ? "quantity_text" : "quantity_missing");
        if (!unit) flags.push("unit_missing");
        const line: ParsedLine = {
          sourceSheet: sheet.name,
          sourceRow: r + 1,
          sourcePage: null,
          lot: lot ?? section,
          code,
          designation,
          description,
          quantity,
          unit,
          confidence: 0,
          flags,
          original: {
            lot,
            section,
            code,
            designation,
            quantity: qtyRaw instanceof Date ? qtyRaw.toISOString() : typeof qtyRaw === "boolean" ? String(qtyRaw) : qtyRaw ?? null,
            unit: unitRaw,
          },
        };
        line.confidence = lineConfidence(line);
        lines.push(line);
        report.lines++;
        previous = line;
        continue;
      }

      // Ligne de texte sans quantité : suite descriptive ou titre de section.
      const isContinuation =
        previous !== null && !code && (/^[a-z(•\-–*]/.test(designation) || designation.length > 90);
      if (isContinuation && previous) {
        previous.description = previous.description ? `${previous.description}\n${designation}` : designation;
        continue;
      }
      const title = code ? `${code} ${designation}` : designation;
      if (/^lot\b/.test(normalized) || /^lot\b/.test(normalizeText(code))) {
        lot = title;
        section = null;
      } else {
        section = title;
      }
      previous = null;
    }
  }
  return { lines, sheets: reports };
}

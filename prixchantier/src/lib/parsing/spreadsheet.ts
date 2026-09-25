import * as XLSX from "@e965/xlsx";
import { decodeText, type Cell } from "./normalize";

export type Sheet = {
  name: string;
  /** rows[r][c] — r et c indexés à partir de 0 ; ligne Excel = r + 1. */
  rows: Cell[][];
  hidden: boolean;
  /** Colonnes masquées (indices 0-based). */
  hiddenColumns: number[];
};

export type Workbook = { sheets: Sheet[] };

export type SpreadsheetKind = "xlsx" | "xls" | "csv";

/**
 * Lit un classeur XLSX / XLS / CSV en tableaux de cellules.
 * Cellules fusionnées : la valeur est recopiée verticalement dans la
 * première colonne de la fusion (lot, désignation sur plusieurs lignes), mais
 * jamais horizontalement — sinon une désignation fusionnée sur trois colonnes
 * se retrouverait dans la colonne quantité.
 */
export function readWorkbook(buffer: Buffer, kind: SpreadsheetKind): Workbook {
  if (kind === "csv") return { sheets: [readCsv(buffer)] };
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, cellFormula: false, cellHTML: false });
  const sheets: Sheet[] = [];
  wb.SheetNames.forEach((name, index) => {
    const ws = wb.Sheets[name];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    });
    for (const merge of ws["!merges"] ?? []) {
      const top = rows[merge.s.r]?.[merge.s.c] ?? null;
      if (top === null || top === "") continue;
      for (let r = merge.s.r + 1; r <= merge.e.r; r++) {
        rows[r] ??= [];
        if (rows[r][merge.s.c] === null || rows[r][merge.s.c] === undefined || rows[r][merge.s.c] === "") {
          rows[r][merge.s.c] = top;
        }
      }
    }
    const hiddenColumns = (ws["!cols"] ?? [])
      .map((c, i) => (c?.hidden ? i : -1))
      .filter((i) => i >= 0);
    const sheetMeta = wb.Workbook?.Sheets?.[index];
    sheets.push({
      name,
      rows: rows.map((r) => (r ?? []).map((v) => (typeof v === "string" ? v.trim() || null : v))),
      hidden: Boolean(sheetMeta?.Hidden),
      hiddenColumns,
    });
  });
  return { sheets };
}

/** CSV : détection du séparateur (; , tab |) et de l'encodage. */
export function readCsv(buffer: Buffer): Sheet {
  const text = decodeText(buffer);
  const sample = text.split(/\r?\n/).slice(0, 20).join("\n");
  const candidates = [";", ",", "\t", "|"];
  const delimiter = candidates
    .map((d) => ({ d, n: countOutsideQuotes(sample, d) }))
    .sort((a, b) => b.n - a.n)[0].d;
  const rows = parseCsv(text, delimiter).map((row) =>
    row.map((v) => {
      const t = v.trim();
      return t === "" ? null : t;
    }),
  );
  return { name: "CSV", rows, hidden: false, hiddenColumns: [] };
}

function countOutsideQuotes(text: string, ch: string) {
  let n = 0;
  let inQuotes = false;
  for (const c of text) {
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ch && !inQuotes) n++;
  }
  return n;
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Texte brut d'un classeur (pour l'extraction IA d'un devis Excel libre). */
export function workbookToText(wb: Workbook, maxChars = 60_000): { text: string; truncated: boolean } {
  const parts: string[] = [];
  for (const sheet of wb.sheets) {
    if (sheet.hidden) continue;
    parts.push(`### Feuille « ${sheet.name} »`);
    sheet.rows.forEach((row, r) => {
      const cells = row.map((c) => (c === null || c === undefined ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c)));
      if (cells.every((c) => c === "")) return;
      parts.push(`L${r + 1}: ${cells.join(" | ")}`);
    });
  }
  const text = parts.join("\n");
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars) + "\n[… contenu tronqué]", truncated: true };
}

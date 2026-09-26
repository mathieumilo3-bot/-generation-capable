import { extractTextItems, getDocumentProxy } from "unpdf";

export type PdfText = {
  pageCount: number;
  /** Texte reconstruit ligne par ligne, une entrée par page. */
  pages: string[];
  totalChars: number;
  /** Vrai si le PDF n'a pas assez de texte exploitable (scan) : OCR/vision requis. */
  needsOcr: boolean;
};

/** Seuil en dessous duquel une page est considérée comme scannée. */
const MIN_CHARS_PER_PAGE = 80;

/**
 * Extrait le texte d'un PDF en reconstruisant les lignes à partir des
 * positions (les tableaux de devis restent lisibles : les cellules d'une même
 * ligne sont séparées par « | »). L'OCR n'est déclenché que si le texte est
 * insuffisant — jamais par défaut.
 */
export async function extractPdfText(buffer: Buffer | Uint8Array): Promise<PdfText> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, items } = await extractTextItems(pdf);
  const pages = items.map((pageItems) => {
    const rows = new Map<number, { x: number; str: string; width: number }[]>();
    for (const it of pageItems) {
      if (!it.str.trim()) continue;
      const key = Math.round(it.y / 3) * 3;
      const row = rows.get(key) ?? [];
      row.push({ x: it.x, str: it.str, width: it.width });
      rows.set(key, row);
    }
    return [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => {
        row.sort((a, b) => a.x - b.x);
        let line = "";
        let end = -Infinity;
        for (const cell of row) {
          if (line) line += cell.x - end > 12 ? " | " : " ";
          line += cell.str.trim();
          end = cell.x + cell.width;
        }
        return line;
      })
      .join("\n");
  });
  const totalChars = pages.reduce((n, p) => n + p.replace(/\s|\|/g, "").length, 0);
  const needsOcr = totalPages > 0 && totalChars / totalPages < MIN_CHARS_PER_PAGE;
  return { pageCount: totalPages, pages, totalChars, needsOcr };
}

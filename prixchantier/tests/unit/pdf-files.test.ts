import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPdfText } from "@/lib/parsing/pdf";
import { contentMatchesKind, fileKind, pathBelongsTo, sanitizeFileName, spreadsheetFormat } from "@/lib/files";

const file = (name: string) => readFileSync(join(__dirname, "../fixtures/files", name));

describe("extraction de texte PDF", () => {
  it("reconstitue les lignes du tableau d'un devis PDF texte, sans OCR", async () => {
    const res = await extractPdfText(file("devis-fournisseur-a.pdf"));
    expect(res.needsOcr).toBe(false);
    expect(res.pageCount).toBe(1);
    expect(res.pages[0]).toMatch(/Devis n° DV-2026-10452/);
    expect(res.pages[0]).toMatch(/FA48210 \| Tube acier noir DN20 \| 120 \| ML \| 8,00 \| 960,00/);
    expect(res.pages[0]).toMatch(/Mise en service non comprise/);
  });

  it("détecte un PDF scanné (texte insuffisant) pour ne déclencher l'OCR qu'à ce moment", async () => {
    const res = await extractPdfText(file("devis-scanne.pdf"));
    expect(res.needsOcr).toBe(true);
    expect(res.totalChars).toBe(0);
  });
});

describe("contrôle des fichiers", () => {
  it("n'accepte que PDF, XLSX, XLS, CSV", () => {
    expect(fileKind("DPGF lot 10.XLSX")).toBe("xlsx");
    expect(fileKind("devis.pdf")).toBe("pdf");
    expect(fileKind("script.exe")).toBeNull();
    expect(fileKind("archive.pdf.zip")).toBeNull();
  });

  it("vérifie la signature binaire", () => {
    expect(contentMatchesKind(file("devis-fournisseur-a.pdf"), "pdf")).toBe(true);
    expect(contentMatchesKind(file("dpgf-standard.xlsx"), "xlsx")).toBe(true);
    expect(contentMatchesKind(file("dpgf-legacy.xls"), "xls")).toBe(true);
    expect(contentMatchesKind(file("dpgf-standard.xlsx"), "pdf")).toBe(false);
    expect(contentMatchesKind(file("devis-fournisseur-a.pdf"), "xlsx")).toBe(false);
    expect(spreadsheetFormat(file("dpgf-standard.xlsx"), "xls")).toBe("xlsx");
  });

  it("assainit les noms de fichiers", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\temp\\devis.pdf")).toBe("devis.pdf");
    expect(sanitizeFileName("DPGF Lot 10 — CVC (indice B).xlsx")).toBe("DPGF_Lot_10_CVC_indice_B.xlsx");
    expect(sanitizeFileName("évier%00.pdf")).toBe("evier_00.pdf");
  });

  it("refuse un chemin de stockage hors organisation / dossier", () => {
    expect(pathBelongsTo("org/proj/source/abc.pdf", "org", "proj", "source")).toBe(true);
    expect(pathBelongsTo("other/proj/source/abc.pdf", "org", "proj")).toBe(false);
    expect(pathBelongsTo("org/proj/../x/abc.pdf", "org", "proj")).toBe(false);
    expect(pathBelongsTo("org/proj/source/a/b.pdf", "org", "proj")).toBe(false);
  });
});

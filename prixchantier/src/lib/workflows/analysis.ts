import "server-only";
import { PDFDocument } from "pdf-lib";
import { adminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { contentMatchesKind, fileKind, spreadsheetFormat } from "@/lib/files";
import { readWorkbook, workbookToText } from "@/lib/parsing/spreadsheet";
import { parseDpgf, type ParsedLine, type SheetReport } from "@/lib/parsing/dpgf";
import { extractPdfText } from "@/lib/parsing/pdf";
import { normalizeUnit, parseNumber } from "@/lib/parsing/normalize";
import { aiConfigured, AiUnavailableError } from "@/lib/ai/llm";
import { classifyLines, extractDpgfLinesFromScan, extractDpgfLinesFromText, type ExtractedPdfLine } from "@/lib/ai/tasks";
import { PermanentJobError } from "@/lib/jobs/runner";
import { downloadFile } from "./storage";
import type { JsonValue } from "@/lib/supabase/json";

type DocSummary = {
  documentId: string;
  name: string;
  kind: string;
  lines: number;
  method: "tableur" | "ia_texte" | "ia_scan" | "aucune";
  sheets?: SheetReport[];
  warnings: string[];
};

const PAGES_PER_CALL = 4;
const SCAN_PAGES_PER_CALL = 5;

function fromAi(l: ExtractedPdfLine): ParsedLine {
  const quantity = parseNumber(l.quantity_text);
  const unit = normalizeUnit(l.unit_text);
  return {
    sourceSheet: null,
    sourceRow: null,
    sourcePage: l.page,
    lot: l.lot,
    code: l.code,
    designation: l.designation.trim(),
    description: l.description,
    quantity,
    unit,
    confidence: Math.min(l.confidence, quantity === null ? 0.6 : 1),
    flags: quantity === null ? ["quantity_missing"] : [],
    original: { lot: l.lot, section: null, code: l.code, designation: l.designation, quantity: l.quantity_text, unit: l.unit_text },
  };
}

async function splitPdf(buffer: Buffer, size: number) {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const chunks: { firstPage: number; data: Buffer }[] = [];
  for (let start = 0; start < src.getPageCount(); start += size) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, Array.from({ length: Math.min(size, src.getPageCount() - start) }, (_, i) => start + i));
    pages.forEach((p) => out.addPage(p));
    chunks.push({ firstPage: start + 1, data: Buffer.from(await out.save()) });
  }
  return chunks;
}

async function extractDocument(doc: { id: string; file_name: string; storage_path: string; kind: string }): Promise<{
  lines: ParsedLine[];
  summary: DocSummary;
  meta: { page_count?: number; text_chars?: number; used_ocr?: boolean };
}> {
  const summary: DocSummary = { documentId: doc.id, name: doc.file_name, kind: doc.kind, lines: 0, method: "aucune", warnings: [] };
  const kind = fileKind(doc.file_name);
  if (!kind) throw new PermanentJobError(`Format non pris en charge : ${doc.file_name}`);
  const buffer = await downloadFile(doc.storage_path);
  if (!contentMatchesKind(buffer, kind)) {
    throw new PermanentJobError(`Le contenu de « ${doc.file_name} » ne correspond pas à son extension.`);
  }

  if (kind !== "pdf") {
    const wb = readWorkbook(buffer, spreadsheetFormat(buffer, kind));
    const parsed = parseDpgf(wb);
    summary.sheets = parsed.sheets;
    if (parsed.lines.length) {
      summary.method = "tableur";
      summary.lines = parsed.lines.length;
      const unreadable = parsed.sheets.reduce((n, s) => n + s.unreadableRows.length, 0);
      if (unreadable) summary.warnings.push(`${unreadable} ligne(s) avec quantité mais sans désignation : à vérifier dans le fichier.`);
      return { lines: parsed.lines, summary, meta: {} };
    }
    // Tableau non standard : l'IA lit le contenu brut, lignes et feuilles citées.
    if (!aiConfigured()) {
      summary.warnings.push("Aucun tableau DPGF reconnu dans ce fichier.");
      return { lines: [], summary, meta: {} };
    }
    const { text, truncated } = workbookToText(wb);
    if (truncated) summary.warnings.push("Fichier très volumineux : seule la première partie a été analysée.");
    const lines = (await extractDpgfLinesFromText([{ page: 1, text }])).map((l) => ({ ...fromAi(l), sourcePage: null }));
    summary.method = "ia_texte";
    summary.lines = lines.length;
    return { lines, summary, meta: {} };
  }

  const pdf = await extractPdfText(buffer);
  const meta = { page_count: pdf.pageCount, text_chars: pdf.totalChars, used_ocr: pdf.needsOcr };
  if (!aiConfigured()) throw new AiUnavailableError();
  const lines: ParsedLine[] = [];
  if (!pdf.needsOcr) {
    for (let p = 0; p < pdf.pages.length; p += PAGES_PER_CALL) {
      const pages = pdf.pages.slice(p, p + PAGES_PER_CALL).map((text, i) => ({ page: p + i + 1, text }));
      lines.push(...(await extractDpgfLinesFromText(pages)).map((l) => fromAi(l)));
    }
    summary.method = "ia_texte";
  } else {
    // Lecture visuelle uniquement parce que le PDF n'a pas de texte exploitable.
    for (const chunk of await splitPdf(buffer, SCAN_PAGES_PER_CALL)) {
      const extracted = await extractDpgfLinesFromScan({ filename: doc.file_name, data: chunk.data, firstPage: chunk.firstPage });
      lines.push(...extracted.map((l) => fromAi(l)));
    }
    summary.method = "ia_scan";
    summary.warnings.push("Document scanné : lecture visuelle, vérifiez les quantités.");
  }
  summary.lines = lines.length;
  return { lines, summary, meta };
}

export async function analyzeProject(projectId: string) {
  const admin = adminClient();
  const { data: project } = await admin.from("projects").select("id, organization_id, name").eq("id", projectId).maybeSingle();
  if (!project) throw new PermanentJobError("Dossier introuvable");
  await admin.from("projects").update({ analysis_status: "running", analysis_error: null }).eq("id", projectId);

  const { data: docs } = await admin
    .from("project_documents")
    .select("id, file_name, storage_path, kind, status")
    .eq("project_id", projectId)
    .in("status", ["uploaded", "processing", "failed"]);

  const { data: existing } = await admin.from("project_lines").select("position").eq("project_id", projectId).order("position", { ascending: false }).limit(1);
  let position = (existing?.[0]?.position ?? -1) + 1;
  const summaries: DocSummary[] = [];
  const failures: string[] = [];
  const newLineIds: { id: string; line: ParsedLine }[] = [];

  for (const doc of docs ?? []) {
    if (doc.kind !== "dpgf") {
      await admin.from("project_documents").update({ status: "skipped", error: null }).eq("id", doc.id);
      continue;
    }
    await admin.from("project_documents").update({ status: "processing", error: null }).eq("id", doc.id);
    try {
      const { lines, summary, meta } = await extractDocument(doc);
      // Réanalyse : on remplace les lignes non encore utilisées de ce document.
      const { error: cleanError } = await admin.from("project_lines").delete().eq("document_id", doc.id);
      if (cleanError) throw new PermanentJobError("Des lignes de ce document sont déjà utilisées dans une consultation.");
      const rows = lines.map((l) => ({
        organization_id: project.organization_id,
        project_id: projectId,
        document_id: doc.id,
        source_document: doc.file_name,
        source_sheet: l.sourceSheet,
        source_row: l.sourceRow,
        source_page: l.sourcePage,
        position: position++,
        lot: l.lot,
        code: l.code,
        designation: l.designation,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        confidence: l.confidence,
        supplier_required: true,
        original: { ...l.original, flags: l.flags } as JsonValue,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { data: inserted, error } = await admin.from("project_lines").insert(rows.slice(i, i + 500)).select("id");
        if (error) throw new Error(`Enregistrement des lignes impossible : ${error.message}`);
        inserted.forEach((r, j) => newLineIds.push({ id: r.id, line: lines[i + j] }));
      }
      await admin
        .from("project_documents")
        .update({ status: "processed", lines_count: lines.length, error: null, ...meta })
        .eq("id", doc.id);
      summaries.push(summary);
    } catch (err) {
      const message =
        err instanceof PermanentJobError || err instanceof AiUnavailableError
          ? err.message
          : "Impossible d'analyser ce document.";
      if (!(err instanceof PermanentJobError) && !(err instanceof AiUnavailableError)) {
        console.error(`[analysis] ${doc.id}:`, err instanceof Error ? err.message : err);
      }
      failures.push(`${doc.file_name} : ${message}`);
      await admin.from("project_documents").update({ status: "failed", error: message }).eq("id", doc.id);
      summaries.push({ documentId: doc.id, name: doc.file_name, kind: doc.kind, lines: 0, method: "aucune", warnings: [message] });
    }
  }

  // Classement IA (famille, consultation, sous-traitance) — n'altère aucune donnée source.
  const warnings: string[] = [];
  if (newLineIds.length) {
    if (aiConfigured()) {
      try {
        const classes = await classifyLines(
          newLineIds.map(({ line }, i) => ({ i, lot: line.lot, code: line.code, designation: line.designation, unit: line.unit })),
        );
        for (let i = 0; i < newLineIds.length; i++) {
          const c = classes.get(i);
          if (!c) continue;
          await admin
            .from("project_lines")
            .update({
              category: c.category,
              supplier_required: c.supplier_required,
              subcontractor_required: c.subcontractor_required,
              confidence: Math.min(newLineIds[i].line.confidence, c.confidence),
            })
            .eq("id", newLineIds[i].id);
        }
        const unclassified = newLineIds.length - classes.size;
        if (unclassified) warnings.push(`${unclassified} ligne(s) non classée(s) automatiquement.`);
      } catch (err) {
        console.error("[analysis] classement:", err instanceof Error ? err.message : err);
        warnings.push("Le classement automatique des familles a échoué : renseignez-les si besoin.");
      }
    } else {
      warnings.push("Classement automatique indisponible : familles d'achat non renseignées.");
    }
  }

  const total = summaries.reduce((n, s) => n + s.lines, 0);
  const status = failures.length && !total ? "failed" : "done";
  await admin
    .from("projects")
    .update({
      analysis_status: status,
      analysis_error: failures.length ? failures.join("\n") : null,
      analysis_summary: { documents: summaries, total_lines: total, warnings, analyzed_at: new Date().toISOString() } as JsonValue,
    })
    .eq("id", projectId);
  await logActivity({
    organizationId: project.organization_id,
    projectId,
    type: "analysis_done",
    message: status === "failed" ? "Analyse du dossier en échec." : `Analyse terminée : ${total} ligne${total > 1 ? "s" : ""} détectée${total > 1 ? "s" : ""}.`,
  });
}

export async function markAnalysisFailed(projectId: string, err: unknown) {
  const message = err instanceof PermanentJobError ? err.message : "Impossible d'analyser ce dossier.";
  await adminClient().from("projects").update({ analysis_status: "failed", analysis_error: message }).eq("id", projectId);
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { ActionError, requireActionSession, runAction, type ActionResult } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { displayFileName, fileKind, MAX_FILE_BYTES, MIME_BY_KIND, pathBelongsTo, storagePath } from "@/lib/files";
import { enqueue, kickWorker } from "@/lib/jobs/queue";
import { logActivity } from "@/lib/activity";
import { normalizeUnit } from "@/lib/parsing/normalize";
import { BUCKET } from "@/lib/workflows/storage";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

const projectSchema = z.object({
  name: z.string().trim().min(1, "Le nom du chantier est obligatoire.").max(200),
  reference: optionalText(100),
  client: optionalText(200),
  responseDeadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

async function ownProject(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id, organization_id, name, closed_at").eq("id", uuid.parse(projectId)).maybeSingle();
  if (!data) throw new ActionError("Dossier introuvable.");
  return { supabase, project: data };
}

export async function createProject(input: z.input<typeof projectSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const s = await requireActionSession();
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: parsed.data.name,
        reference: parsed.data.reference ?? null,
        client: parsed.data.client ?? null,
        response_deadline: parsed.data.responseDeadline ?? null,
        created_by: s.userId,
      })
      .select("id")
      .single();
    if (error) throw new ActionError("Impossible de créer le dossier.");
    await logActivity({ organizationId: s.organizationId, projectId: data.id, type: "project_created", message: `Dossier « ${parsed.data.name} » créé.` });
    return { id: data.id };
  });
}

export async function updateProject(projectId: string, input: z.input<typeof projectSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const { supabase } = await ownProject(projectId);
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const { error } = await supabase
      .from("projects")
      .update({
        name: parsed.data.name,
        reference: parsed.data.reference ?? null,
        client: parsed.data.client ?? null,
        response_deadline: parsed.data.responseDeadline ?? null,
      })
      .eq("id", projectId);
    if (error) throw new ActionError("Enregistrement impossible.");
    revalidatePath(`/dossiers/${projectId}`);
  });
}

export async function setProjectClosed(projectId: string, closed: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const { supabase, project } = await ownProject(projectId);
    const { error } = await supabase.from("projects").update({ closed_at: closed ? new Date().toISOString() : null }).eq("id", projectId);
    if (error) throw new ActionError("Enregistrement impossible.");
    if (closed) {
      // Plus aucune relance sur un dossier terminé.
      const { data: cons } = await supabase.from("consultations").select("id").eq("project_id", projectId);
      if (cons?.length) {
        await adminClient()
          .from("scheduled_followups")
          .update({ status: "cancelled", reason: "Dossier terminé" })
          .in("consultation_id", cons.map((c) => c.id))
          .eq("status", "scheduled");
      }
    }
    await logActivity({ organizationId: s.organizationId, projectId, type: closed ? "project_closed" : "project_reopened", message: closed ? `Dossier « ${project.name} » marqué terminé.` : "Dossier rouvert." });
    revalidatePath(`/dossiers/${projectId}`);
    revalidatePath("/");
  });
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    await enforceRateLimit("destructive", s.userId);
    const { supabase } = await ownProject(projectId);
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) throw new ActionError("Suppression impossible.");
    await removeFolder(`${s.organizationId}/${projectId}`);
    revalidatePath("/");
  });
}

/** Supprime récursivement les fichiers d'un dossier de stockage. */
async function removeFolder(prefix: string) {
  const storage = adminClient().storage.from(BUCKET);
  const { data: entries } = await storage.list(prefix, { limit: 1000 });
  for (const e of entries ?? []) {
    const path = `${prefix}/${e.name}`;
    if (e.id === null) await removeFolder(path);
    else await storage.remove([path]);
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const fileInput = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive(),
  kind: z.enum(["dpgf", "cctp", "other"]),
});

/** Prépare des URL d'envoi signées : le serveur décide des chemins, le navigateur envoie directement. */
export async function prepareUploads(
  projectId: string,
  files: z.input<typeof fileInput>[],
): Promise<ActionResult<{ path: string; token: string; name: string }[]>> {
  return runAction(async () => {
    const s = await requireActionSession();
    await ownProject(projectId);
    const list = z.array(fileInput).min(1).max(20).safeParse(files);
    if (!list.success) throw new ActionError("Liste de fichiers invalide (20 fichiers maximum).");
    await enforceRateLimit("upload", s.userId);
    const out = [];
    for (const f of list.data) {
      if (!fileKind(f.name)) throw new ActionError(`« ${f.name} » : seuls les fichiers PDF, XLSX, XLS et CSV sont acceptés.`);
      if (f.size > MAX_FILE_BYTES) throw new ActionError(`« ${f.name} » dépasse 25 Mo.`);
      const path = storagePath(s.organizationId, projectId, "source", f.name);
      const { data, error } = await adminClient().storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw new ActionError("Préparation de l'envoi impossible. Réessayez.");
      out.push({ path, token: data.token, name: f.name });
    }
    return out;
  });
}

export async function registerDocuments(
  projectId: string,
  docs: { path: string; name: string; kind: "dpgf" | "cctp" | "other" }[],
): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const { supabase } = await ownProject(projectId);
    const storage = adminClient().storage.from(BUCKET);
    for (const d of docs) {
      const kind = fileKind(d.name);
      if (!kind || !pathBelongsTo(d.path, s.organizationId, projectId, "source")) throw new ActionError("Fichier invalide.");
      const { data: info, error } = await storage.info(d.path);
      if (error || !info?.size) throw new ActionError(`« ${d.name} » n'a pas été reçu. Réessayez l'envoi.`);
      if (info.size > MAX_FILE_BYTES) {
        await storage.remove([d.path]);
        throw new ActionError(`« ${d.name} » dépasse 25 Mo.`);
      }
      const { error: insertError } = await supabase.from("project_documents").insert({
        project_id: projectId,
        kind: z.enum(["dpgf", "cctp", "other"]).parse(d.kind),
        file_name: displayFileName(d.name),
        storage_path: d.path,
        mime_type: MIME_BY_KIND[kind],
        size_bytes: info.size,
      });
      if (insertError && insertError.code !== "23505") throw new ActionError("Enregistrement du document impossible.");
    }
    revalidatePath(`/dossiers/${projectId}`);
  });
}

export async function setDocumentKind(documentId: string, kind: "dpgf" | "cctp" | "other"): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("project_documents")
      .update({ kind: z.enum(["dpgf", "cctp", "other"]).parse(kind), status: "uploaded" })
      .eq("id", uuid.parse(documentId))
      .in("status", ["uploaded", "skipped", "failed"])
      .select("project_id")
      .maybeSingle();
    if (error || !data) throw new ActionError("Ce document a déjà été analysé.");
    revalidatePath(`/dossiers/${data.project_id}`);
  });
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const supabase = await createClient();
    const { data: doc } = await supabase.from("project_documents").select("id, project_id, storage_path").eq("id", uuid.parse(documentId)).maybeSingle();
    if (!doc) throw new ActionError("Document introuvable.");
    const { count } = await supabase.from("consultations").select("id", { count: "exact", head: true }).contains("attached_document_ids", [doc.id]);
    if (count) throw new ActionError("Ce document est joint à une consultation : il ne peut pas être supprimé.");
    const { error: linesError } = await supabase.from("project_lines").delete().eq("document_id", doc.id);
    if (linesError) throw new ActionError("Des lignes de ce document sont utilisées dans une consultation.");
    const { error } = await supabase.from("project_documents").delete().eq("id", doc.id);
    if (error) throw new ActionError("Suppression impossible.");
    await adminClient().storage.from(BUCKET).remove([doc.storage_path]);
    revalidatePath(`/dossiers/${doc.project_id}`);
  });
}

export async function startAnalysis(projectId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const { supabase } = await ownProject(projectId);
    await enforceRateLimit("analysis", s.userId);
    const { count } = await supabase
      .from("project_documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .in("status", ["uploaded", "failed", "processing"]);
    if (!count) throw new ActionError("Aucun nouveau document à analyser.");
    await supabase.from("projects").update({ analysis_status: "pending", analysis_error: null }).eq("id", projectId);
    await enqueue("analyze_project", { projectId }, { organizationId: s.organizationId, dedupeKey: `analyze:${projectId}` });
    kickWorker();
    revalidatePath(`/dossiers/${projectId}`);
  });
}

// ---------------------------------------------------------------------------
// Lignes du dossier
// ---------------------------------------------------------------------------

const lineSchema = z.object({
  lot: optionalText(300),
  code: optionalText(100),
  designation: z.string().trim().min(1, "La désignation est obligatoire.").max(2000),
  quantity: z.number().finite().nonnegative().nullable(),
  unit: optionalText(30),
  category: optionalText(100),
  supplierRequired: z.boolean(),
});

export async function updateLine(lineId: string, input: z.input<typeof lineSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const parsed = lineSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const supabase = await createClient();
    // La valeur d'origine reste dans `original` : seule la valeur normalisée change.
    const { data, error } = await supabase
      .from("project_lines")
      .update({
        lot: parsed.data.lot ?? null,
        code: parsed.data.code ?? null,
        designation: parsed.data.designation,
        quantity: parsed.data.quantity,
        unit: normalizeUnit(parsed.data.unit ?? null),
        category: parsed.data.category ?? null,
        supplier_required: parsed.data.supplierRequired,
        user_modified: true,
        user_validated: true,
      })
      .eq("id", uuid.parse(lineId))
      .select("project_id")
      .maybeSingle();
    if (error || !data) throw new ActionError("Enregistrement impossible.");
    revalidatePath(`/dossiers/${data.project_id}`);
  });
}

export async function addLine(projectId: string, input: z.input<typeof lineSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const { supabase } = await ownProject(projectId);
    const parsed = lineSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const { data: last } = await supabase.from("project_lines").select("position").eq("project_id", projectId).order("position", { ascending: false }).limit(1);
    const { error } = await supabase.from("project_lines").insert({
      project_id: projectId,
      position: (last?.[0]?.position ?? -1) + 1,
      lot: parsed.data.lot ?? null,
      code: parsed.data.code ?? null,
      designation: parsed.data.designation,
      quantity: parsed.data.quantity,
      unit: normalizeUnit(parsed.data.unit ?? null),
      category: parsed.data.category ?? null,
      supplier_required: parsed.data.supplierRequired,
      source_document: "Saisie manuelle",
      confidence: 1,
      user_validated: true,
      original: { manual: true },
    });
    if (error) throw new ActionError("Ajout impossible.");
    revalidatePath(`/dossiers/${projectId}`);
  });
}

export async function deleteLine(lineId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const supabase = await createClient();
    const { data, error } = await supabase.from("project_lines").delete().eq("id", uuid.parse(lineId)).select("project_id").maybeSingle();
    if (error) throw new ActionError("Cette ligne est utilisée dans une consultation : décochez-la plutôt que de la supprimer.");
    if (data) revalidatePath(`/dossiers/${data.project_id}`);
  });
}

export async function setLinesSupplierRequired(projectId: string, lineIds: string[], value: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const { supabase } = await ownProject(projectId);
    const ids = z.array(uuid).max(5000).parse(lineIds);
    const { error } = await supabase.from("project_lines").update({ supplier_required: value }).eq("project_id", projectId).in("id", ids);
    if (error) throw new ActionError("Enregistrement impossible.");
    revalidatePath(`/dossiers/${projectId}`);
  });
}

export async function validateLines(projectId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const { supabase } = await ownProject(projectId);
    const { error } = await supabase.from("project_lines").update({ user_validated: true }).eq("project_id", projectId).eq("user_validated", false);
    if (error) throw new ActionError("Validation impossible.");
    await logActivity({ organizationId: s.organizationId, projectId, type: "lines_validated", message: "Lignes du dossier validées." });
    revalidatePath(`/dossiers/${projectId}`);
  });
}

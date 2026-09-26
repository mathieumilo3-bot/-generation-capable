"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { ActionError, requireActionSession, runAction, type ActionResult } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { defaultConnection } from "@/lib/mail/connections";
import { consultationBody, consultationSubject, followupDueDate, newReferenceCode } from "@/lib/workflows/email-templates";
import { sendConsultation, sendFollowup, SendError } from "@/lib/workflows/sending";
import { cancelFollowups } from "@/lib/workflows/followups";
import { createManualResponse, type StoredFile } from "@/lib/workflows/responses";
import { enqueue, kickWorker } from "@/lib/jobs/queue";
import { logActivity } from "@/lib/activity";
import { fileKind, MAX_FILE_BYTES, MIME_BY_KIND, pathBelongsTo, storagePath } from "@/lib/files";
import { BUCKET } from "@/lib/workflows/storage";

const uuid = z.uuid();

const createSchema = z.object({
  supplierIds: z.array(uuid).min(1, "Sélectionnez au moins un fournisseur.").max(50),
  lineIds: z.array(uuid).min(1, "Sélectionnez au moins une ligne.").max(5000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  includeExcel: z.boolean(),
  autoFollowup: z.boolean(),
  attachedDocumentIds: z.array(uuid).max(10),
});

export async function createConsultations(projectId: string, input: z.input<typeof createSchema>): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const s = await requireActionSession();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const d = parsed.data;
    const supabase = await createClient();
    const { data: project } = await supabase.from("projects").select("id, name, reference, client, closed_at").eq("id", uuid.parse(projectId)).maybeSingle();
    if (!project) throw new ActionError("Dossier introuvable.");
    if (project.closed_at) throw new ActionError("Ce dossier est terminé.");

    const { data: lines } = await supabase.from("project_lines").select("id, position").eq("project_id", projectId).in("id", d.lineIds).order("position");
    if (!lines?.length || lines.length !== new Set(d.lineIds).size) throw new ActionError("Certaines lignes n'appartiennent pas à ce dossier.");
    const { data: suppliers } = await supabase.from("suppliers").select("id").in("id", d.supplierIds);
    if (suppliers?.length !== new Set(d.supplierIds).size) throw new ActionError("Fournisseur introuvable.");
    if (d.attachedDocumentIds.length) {
      const { count } = await supabase.from("project_documents").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("id", d.attachedDocumentIds);
      if (count !== d.attachedDocumentIds.length) throw new ActionError("Document joint invalide.");
    }
    const conn = await defaultConnection(s.organizationId, s.userId);

    for (const supplierId of d.supplierIds) {
      let consultationId: string | null = null;
      for (let attempt = 0; attempt < 5 && !consultationId; attempt++) {
        const referenceCode = newReferenceCode();
        const { data, error } = await supabase
          .from("consultations")
          .insert({
            project_id: projectId,
            supplier_id: supplierId,
            mail_connection_id: conn?.id ?? null,
            reference_code: referenceCode,
            status: "a_envoyer",
            response_due_date: d.dueDate,
            include_excel: d.includeExcel,
            auto_followup: d.autoFollowup,
            attached_document_ids: d.attachedDocumentIds,
            subject: consultationSubject({ projectName: project.name, projectReference: project.reference, referenceCode }),
            body: consultationBody({
              projectName: project.name,
              client: project.client,
              dueDate: d.dueDate,
              lineCount: lines.length,
              senderName: s.fullName,
              organizationName: s.organizationName,
              withExcel: d.includeExcel,
            }),
            created_by: s.userId,
          })
          .select("id")
          .single();
        if (error && error.code !== "23505") throw new ActionError("Création de la consultation impossible.");
        consultationId = data?.id ?? null;
      }
      if (!consultationId) throw new ActionError("Création de la consultation impossible.");
      const { error } = await supabase
        .from("consultation_lines")
        .insert(lines.map((l, i) => ({ consultation_id: consultationId!, project_line_id: l.id, position: i })));
      if (error) throw new ActionError("Enregistrement des lignes de la consultation impossible.");
    }
    await logActivity({
      organizationId: s.organizationId,
      projectId,
      type: "consultations_created",
      message: `${d.supplierIds.length} consultation${d.supplierIds.length > 1 ? "s" : ""} préparée${d.supplierIds.length > 1 ? "s" : ""} (${lines.length} lignes).`,
    });
    revalidatePath(`/dossiers/${projectId}`);
    return { count: d.supplierIds.length };
  });
}

const draftSchema = z.object({
  subject: z.string().trim().min(1, "L'objet est obligatoire.").max(300),
  body: z.string().trim().min(1, "Le message est obligatoire.").max(10000),
  includeExcel: z.boolean(),
  autoFollowup: z.boolean(),
});

async function ownConsultation(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultations")
    .select("id, project_id, status, reference_code, auto_followup, followup_count, sent_at, suppliers(company_name)")
    .eq("id", uuid.parse(id))
    .maybeSingle();
  if (!data) throw new ActionError("Consultation introuvable.");
  return { supabase, c: data };
}

export async function updateDraft(id: string, input: z.input<typeof draftSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const { supabase, c } = await ownConsultation(id);
    if (!["a_envoyer", "erreur"].includes(c.status)) throw new ActionError("Cette consultation a déjà été envoyée.");
    // La référence doit rester dans l'objet : c'est elle qui permet de rattacher les réponses.
    const subject = parsed.data.subject.includes(c.reference_code) ? parsed.data.subject : `${parsed.data.subject} [${c.reference_code}]`;
    const { error } = await supabase
      .from("consultations")
      .update({ subject, body: parsed.data.body, include_excel: parsed.data.includeExcel, auto_followup: parsed.data.autoFollowup })
      .eq("id", c.id);
    if (error) throw new ActionError("Enregistrement impossible.");
  });
}

/** Envoi validé par l'utilisateur. Le contenu enregistré est exactement celui qui part. */
export async function sendConsultationAction(id: string, input: z.input<typeof draftSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const saved = await updateDraft(id, input);
    if (!saved.ok) throw new ActionError(saved.error);
    await enforceRateLimit("send", s.userId);
    const { c } = await ownConsultation(id);
    const conn = await defaultConnection(s.organizationId, s.userId);
    if (!conn) throw new ActionError("Connectez d'abord votre boîte mail (Paramètres).");
    if (conn.status !== "active") {
      throw new ActionError(conn.provider === "microsoft" ? "Votre connexion Microsoft a expiré. Reconnectez votre boîte mail." : "Votre connexion Gmail a expiré. Reconnectez votre boîte mail.");
    }
    await adminClient().from("consultations").update({ mail_connection_id: conn.id }).eq("id", c.id).eq("organization_id", s.organizationId);
    try {
      await sendConsultation(c.id, s.organizationId);
    } catch (err) {
      if (err instanceof SendError) throw new ActionError(err.message);
      throw err;
    }
    revalidatePath(`/dossiers/${c.project_id}`);
  });
}

export async function deleteDraft(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const { supabase, c } = await ownConsultation(id);
    if (c.status !== "a_envoyer") throw new ActionError("Seul un brouillon peut être supprimé.");
    const { error } = await supabase.from("consultations").delete().eq("id", c.id);
    if (error) throw new ActionError("Suppression impossible.");
    revalidatePath(`/dossiers/${c.project_id}`);
  });
}

export async function cancelConsultation(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const { supabase, c } = await ownConsultation(id);
    const { error } = await supabase.from("consultations").update({ status: "annulee" }).eq("id", c.id);
    if (error) throw new ActionError("Annulation impossible.");
    await cancelFollowups(c.id, "Consultation annulée");
    await logActivity({ organizationId: s.organizationId, projectId: c.project_id, consultationId: c.id, type: "consultation_cancelled", message: `Consultation de ${c.suppliers?.company_name} annulée.` });
    revalidatePath(`/dossiers/${c.project_id}`);
  });
}

export async function setAutoFollowup(id: string, value: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const { supabase, c } = await ownConsultation(id);
    const awaiting = ["envoye", "relance_prevue", "relance"].includes(c.status);
    const { error } = await supabase
      .from("consultations")
      .update({
        auto_followup: value,
        ...(awaiting && c.status !== "relance" ? { status: value ? "relance_prevue" : "envoye" } : {}),
      })
      .eq("id", c.id);
    if (error) throw new ActionError("Enregistrement impossible.");
    if (!value) await cancelFollowups(c.id, "Relance automatique désactivée");
    else if (awaiting && c.sent_at && c.followup_count < 2) {
      const attempt = c.followup_count + 1;
      const due = followupDueDate(c.followup_count ? new Date() : new Date(c.sent_at), attempt);
      await adminClient()
        .from("scheduled_followups")
        .upsert(
          { organization_id: s.organizationId, consultation_id: c.id, attempt, due_at: (due < new Date() ? new Date() : due).toISOString(), status: "scheduled", reason: null },
          { onConflict: "consultation_id,attempt" },
        );
    }
    revalidatePath(`/dossiers/${c.project_id}`);
  });
}

export async function followupNow(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    await enforceRateLimit("send", s.userId);
    const { c } = await ownConsultation(id);
    try {
      const res = await sendFollowup(c.id, s.organizationId, { attempt: c.followup_count + 1, automatic: false });
      if (!res.sent) throw new ActionError(res.reason);
      await adminClient()
        .from("scheduled_followups")
        .update({ status: "cancelled", reason: "Relance manuelle envoyée" })
        .eq("consultation_id", c.id)
        .eq("attempt", c.followup_count + 1)
        .eq("status", "scheduled");
    } catch (err) {
      if (err instanceof SendError) throw new ActionError(err.message);
      throw err;
    }
    revalidatePath(`/dossiers/${c.project_id}`);
  });
}

/** Relève immédiate de la boîte mail (en plus de la relève automatique). */
export async function checkMailNow(projectId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    await enforceRateLimit("oauth", `poll:${s.organizationId}`);
    const conn = await defaultConnection(s.organizationId, s.userId);
    if (!conn || conn.status !== "active") throw new ActionError("Aucune boîte mail active.");
    await enqueue("poll_mailbox", { connectionId: conn.id }, { organizationId: s.organizationId, dedupeKey: `poll:${conn.id}`, maxAttempts: 1 });
    kickWorker();
    revalidatePath(`/dossiers/${projectId}`);
  });
}

// ---------------------------------------------------------------------------
// Réponses et offres
// ---------------------------------------------------------------------------

/** Offre reçue hors messagerie : l'utilisateur dépose le fichier. */
export async function prepareOfferUpload(consultationId: string, file: { name: string; size: number }): Promise<ActionResult<{ path: string; token: string }>> {
  return runAction(async () => {
    const s = await requireActionSession();
    const { c } = await ownConsultation(consultationId);
    if (!fileKind(file.name)) throw new ActionError("Seuls les fichiers PDF, XLSX, XLS et CSV sont acceptés.");
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) throw new ActionError("Fichier vide ou supérieur à 25 Mo.");
    await enforceRateLimit("upload", s.userId);
    const path = storagePath(s.organizationId, c.project_id, "responses", file.name);
    const { data, error } = await adminClient().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new ActionError("Préparation de l'envoi impossible.");
    return { path, token: data.token };
  });
}

export async function registerOfferUpload(consultationId: string, upload: { path: string; name: string }): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const { c } = await ownConsultation(consultationId);
    const kind = fileKind(upload.name);
    if (!kind || !pathBelongsTo(upload.path, s.organizationId, c.project_id, "responses")) throw new ActionError("Fichier invalide.");
    const { data: info, error } = await adminClient().storage.from(BUCKET).info(upload.path);
    if (error || !info?.size) throw new ActionError("Le fichier n'a pas été reçu. Réessayez.");
    const files: StoredFile[] = [{ name: upload.name, path: upload.path, mime: MIME_BY_KIND[kind], size: info.size }];
    await createManualResponse(s.organizationId, c.id, files);
    await logActivity({ organizationId: s.organizationId, projectId: c.project_id, consultationId: c.id, type: "offer_imported", message: `Offre de ${c.suppliers?.company_name} importée manuellement.` });
    kickWorker();
    revalidatePath(`/dossiers/${c.project_id}`);
  });
}

export async function retryResponse(responseId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const supabase = await createClient();
    const { data: r } = await supabase.from("supplier_responses").select("id, project_id, status").eq("id", uuid.parse(responseId)).maybeSingle();
    if (!r || !r.project_id) throw new ActionError("Réponse introuvable.");
    if (r.status === "processing") throw new ActionError("Analyse déjà en cours.");
    await enforceRateLimit("analysis", s.userId);
    await supabase.from("supplier_responses").update({ status: "pending", error: null }).eq("id", r.id);
    await enqueue("process_response", { responseId: r.id }, { organizationId: s.organizationId, dedupeKey: `response:${r.id}` });
    kickWorker();
    revalidatePath(`/dossiers/${r.project_id}`);
  });
}

/** Rattachement manuel d'une réponse que le système n'a pas pu attribuer avec certitude. */
export async function assignResponse(responseId: string, consultationId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireActionSession();
    const supabase = await createClient();
    const { data: r } = await supabase.from("supplier_responses").select("id, email_message_id, status").eq("id", uuid.parse(responseId)).maybeSingle();
    if (!r || r.status !== "needs_assignment") throw new ActionError("Réponse introuvable ou déjà rattachée.");
    const { c } = await ownConsultation(consultationId);
    const admin = adminClient();
    await admin
      .from("supplier_responses")
      .update({ consultation_id: c.id, project_id: c.project_id, match_method: "manual", status: "pending" })
      .eq("id", r.id)
      .eq("organization_id", s.organizationId);
    if (r.email_message_id) {
      await admin.from("email_messages").update({ consultation_id: c.id, project_id: c.project_id }).eq("id", r.email_message_id).eq("organization_id", s.organizationId);
    }
    await enqueue("process_response", { responseId: r.id }, { organizationId: s.organizationId, dedupeKey: `response:${r.id}` });
    await logActivity({ organizationId: s.organizationId, projectId: c.project_id, consultationId: c.id, type: "response_assigned", message: `Réponse de ${c.suppliers?.company_name} rattachée manuellement.` });
    kickWorker();
    revalidatePath("/");
    revalidatePath(`/dossiers/${c.project_id}`);
  });
}

/** Confirmer, rejeter ou corriger le rattachement d'une ligne d'offre. Les prix ne sont jamais modifiés. */
export async function setOfferLineMatch(offerLineId: string, decision: { projectLineId: string | null; confirm: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionSession();
    const supabase = await createClient();
    const { data: line } = await supabase.from("offer_lines").select("id, offer_id, offers(project_id, consultation_id)").eq("id", uuid.parse(offerLineId)).maybeSingle();
    if (!line?.offers) throw new ActionError("Ligne introuvable.");
    let projectLineId = decision.projectLineId;
    if (projectLineId) {
      const { count } = await supabase
        .from("consultation_lines")
        .select("id", { count: "exact", head: true })
        .eq("consultation_id", line.offers.consultation_id)
        .eq("project_line_id", uuid.parse(projectLineId));
      if (!count) throw new ActionError("Cette ligne ne fait pas partie de la consultation.");
      // Une ligne demandée ne peut être rattachée qu'à une seule ligne d'offre.
      await supabase
        .from("offer_lines")
        .update({ project_line_id: null, match_status: "unmatched" })
        .eq("offer_id", line.offer_id)
        .eq("project_line_id", projectLineId)
        .neq("id", line.id);
    } else projectLineId = null;
    const { error } = await supabase
      .from("offer_lines")
      .update({
        project_line_id: projectLineId,
        match_status: projectLineId ? (decision.confirm ? "user_confirmed" : "to_verify") : "user_rejected",
        match_method: "manual",
      })
      .eq("id", line.id);
    if (error) throw new ActionError("Enregistrement impossible.");
    revalidatePath(`/dossiers/${line.offers.project_id}`);
  });
}

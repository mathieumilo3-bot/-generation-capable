import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { loadConnection, markExpired, providerFor } from "@/lib/mail/connections";
import { MailAuthError, MailRejectedError, type MailAttachment } from "@/lib/mail/types";
import { buildConsultationWorkbook } from "@/lib/offers/template";
import { storagePath } from "@/lib/files";
import type { JsonValue } from "@/lib/supabase/json";
import { downloadFile, uploadFile } from "./storage";
import { followupBody, followupDueDate, parisDay } from "./email-templates";

export class SendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SendError";
  }
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function consultationContext(consultationId: string, organizationId: string) {
  const admin = adminClient();
  const { data: c } = await admin
    .from("consultations")
    .select("*, suppliers(company_name, contact_name, email), projects(id, name, reference, closed_at)")
    .eq("id", consultationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!c || !c.suppliers || !c.projects) throw new SendError("Consultation introuvable.");
  const { data: org } = await admin.from("organizations").select("name").eq("id", organizationId).single();
  return { c, supplier: c.suppliers, project: c.projects, orgName: org?.name ?? "" };
}

/** Fichier Excel de la consultation : uniquement les lignes envoyées à ce fournisseur. */
export async function consultationExcel(consultationId: string, organizationId: string) {
  const admin = adminClient();
  const { c, project, orgName } = await consultationContext(consultationId, organizationId);
  const { data: lines } = await admin
    .from("consultation_lines")
    .select("position, project_lines(id, code, designation, quantity, unit)")
    .eq("consultation_id", consultationId)
    .order("position");
  const templateLines = (lines ?? [])
    .map((l) => l.project_lines)
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
    .map((l) => ({ id: l.id, code: l.code, designation: l.designation, quantity: l.quantity, unit: l.unit }));
  const buffer = await buildConsultationWorkbook({
    referenceCode: c.reference_code,
    projectName: project.name,
    organizationName: orgName,
    dueDate: c.response_due_date,
    lines: templateLines,
  });
  return { buffer, filename: `Demande de prix ${c.reference_code}.xlsx`, lineCount: templateLines.length };
}

/**
 * Envoie le PREMIER message d'une consultation, après validation explicite de
 * l'utilisateur, depuis sa vraie boîte Gmail / Microsoft 365.
 */
export async function sendConsultation(consultationId: string, organizationId: string) {
  const admin = adminClient();
  const { c, supplier, project } = await consultationContext(consultationId, organizationId);
  if (!["a_envoyer", "erreur"].includes(c.status)) throw new SendError("Cette consultation a déjà été envoyée.");
  if (project.closed_at) throw new SendError("Ce dossier est terminé.");
  if (!c.mail_connection_id) throw new SendError("Connectez une boîte mail pour envoyer la consultation.");
  const conn = await loadConnection(c.mail_connection_id, organizationId);
  if (!conn) throw new SendError("Connectez une boîte mail pour envoyer la consultation.");
  if (!c.subject.trim() || !c.body.trim()) throw new SendError("L'objet et le message sont obligatoires.");

  const attachments: MailAttachment[] = [];
  const stored: { name: string; path: string; mime: string; size: number }[] = [];
  if (c.include_excel) {
    const excel = await consultationExcel(consultationId, organizationId);
    if (!excel.lineCount) throw new SendError("Aucune ligne dans cette consultation.");
    attachments.push({ filename: excel.filename, contentType: XLSX_MIME, content: excel.buffer });
    const path = storagePath(organizationId, project.id, "consultations", excel.filename);
    await uploadFile(path, excel.buffer, XLSX_MIME);
    stored.push({ name: excel.filename, path, mime: XLSX_MIME, size: excel.buffer.length });
  }
  if (c.attached_document_ids.length) {
    const { data: docs } = await admin
      .from("project_documents")
      .select("file_name, storage_path, mime_type, size_bytes")
      .eq("organization_id", organizationId)
      .eq("project_id", project.id)
      .in("id", c.attached_document_ids);
    for (const d of docs ?? []) {
      attachments.push({ filename: d.file_name, contentType: d.mime_type ?? "application/octet-stream", content: await downloadFile(d.storage_path) });
      stored.push({ name: d.file_name, path: d.storage_path, mime: d.mime_type ?? "", size: d.size_bytes });
    }
  }
  const total = attachments.reduce((n, a) => n + a.content.length, 0);
  if (total > 20 * 1024 * 1024) throw new SendError("Pièces jointes trop volumineuses (20 Mo maximum par e-mail).");

  const { data: me } = await admin.from("users").select("full_name").eq("id", c.created_by ?? "").maybeSingle();
  try {
    const sent = await providerFor(conn).send({
      fromEmail: conn.email,
      fromName: conn.display_name ?? me?.full_name ?? null,
      to: supplier.email,
      toName: supplier.contact_name,
      subject: c.subject,
      text: c.body,
      attachments,
    });
    const { data: msg } = await admin
      .from("email_messages")
      .insert({
        organization_id: organizationId,
        mail_connection_id: conn.id,
        project_id: project.id,
        consultation_id: c.id,
        direction: "outbound",
        kind: "consultation",
        provider_message_id: sent.providerMessageId,
        provider_thread_id: sent.providerThreadId,
        internet_message_id: sent.internetMessageId,
        from_email: conn.email,
        to_emails: [supplier.email],
        subject: c.subject,
        body_text: c.body,
        attachments: stored as JsonValue,
        message_at: sent.sentAt,
      })
      .select("id")
      .single();
    await admin
      .from("consultations")
      .update({
        status: c.auto_followup ? "relance_prevue" : "envoye",
        sent_at: sent.sentAt,
        provider_message_id: sent.providerMessageId,
        provider_thread_id: sent.providerThreadId,
        internet_message_id: sent.internetMessageId,
        error: null,
      })
      .eq("id", c.id);
    if (c.auto_followup) {
      await admin.from("scheduled_followups").upsert(
        {
          organization_id: organizationId,
          consultation_id: c.id,
          attempt: 1,
          due_at: followupDueDate(new Date(sent.sentAt), 1).toISOString(),
          status: "scheduled",
        },
        { onConflict: "consultation_id,attempt" },
      );
    }
    await logActivity({ organizationId, projectId: project.id, consultationId: c.id, type: "consultation_sent", message: `Consultation envoyée à ${supplier.company_name}.` });
    return { messageId: msg?.id };
  } catch (err) {
    if (err instanceof MailAuthError) {
      await markExpired(conn.id, err.message);
      await admin.from("consultations").update({ error: err.message }).eq("id", c.id);
      throw new SendError(err.message);
    }
    if (err instanceof MailRejectedError || (conn.provider === "test" && err instanceof Error && /refusée/.test(err.message))) {
      await admin.from("consultations").update({ status: "erreur", error: err.message }).eq("id", c.id);
      await logActivity({ organizationId, projectId: project.id, consultationId: c.id, type: "consultation_error", message: `Échec d'envoi à ${supplier.company_name} : adresse refusée.` });
      throw new SendError(`${err.message} Vérifiez l'adresse de ${supplier.company_name}.`);
    }
    console.error("[send] échec:", err instanceof Error ? err.message : err);
    await admin.from("consultations").update({ error: "L'envoi a échoué. Réessayez." }).eq("id", c.id);
    throw new SendError("L'envoi a échoué. Réessayez dans un instant.");
  }
}

const FOLLOWUP_ALLOWED = new Set(["envoye", "relance_prevue", "relance"]);
export const MAX_AUTO_FOLLOWUPS = 2;

/**
 * Envoie une relance dans le fil d'origine. Garde-fous : jamais à un
 * fournisseur ayant répondu / refusé / en erreur / annulé, jamais deux
 * relances le même jour, jamais sur un dossier terminé.
 */
export async function sendFollowup(
  consultationId: string,
  organizationId: string,
  opts: { attempt: number; automatic: boolean },
): Promise<{ sent: true; emailMessageId: string } | { sent: false; reason: string }> {
  const admin = adminClient();
  const { c, supplier, project, orgName } = await consultationContext(consultationId, organizationId);
  if (!FOLLOWUP_ALLOWED.has(c.status)) return { sent: false, reason: "Consultation non relançable (réponse reçue, refus, erreur ou annulation)." };
  if (project.closed_at) return { sent: false, reason: "Dossier terminé." };
  if (opts.automatic && !c.auto_followup) return { sent: false, reason: "Relance automatique désactivée." };
  if (!c.provider_message_id || !c.mail_connection_id) return { sent: false, reason: "Message d'origine introuvable." };

  const { data: lastOut } = await admin
    .from("email_messages")
    .select("message_at")
    .eq("consultation_id", c.id)
    .eq("direction", "outbound")
    .order("message_at", { ascending: false })
    .limit(1);
  if (lastOut?.[0] && parisDay(new Date(lastOut[0].message_at)) === parisDay(new Date())) {
    return { sent: false, reason: "Un message a déjà été envoyé aujourd'hui à ce fournisseur." };
  }
  const { data: inbound } = await admin.from("email_messages").select("id").eq("consultation_id", c.id).eq("direction", "inbound").limit(1);
  if (inbound?.length) return { sent: false, reason: "Le fournisseur a déjà écrit : vérifiez sa réponse." };

  const conn = await loadConnection(c.mail_connection_id, organizationId);
  if (!conn) return { sent: false, reason: "Boîte mail déconnectée." };
  const { data: sender } = await admin.from("users").select("full_name").eq("id", c.created_by ?? "").maybeSingle();
  const text = followupBody({
    projectName: project.name,
    attempt: opts.attempt,
    dueDate: c.response_due_date,
    senderName: sender?.full_name ?? null,
    organizationName: orgName,
  });
  const subject = c.subject.startsWith("Re:") ? c.subject : `Re: ${c.subject}`;
  try {
    const sent = await providerFor(conn).send({
      fromEmail: conn.email,
      fromName: conn.display_name,
      to: supplier.email,
      toName: supplier.contact_name,
      subject,
      text,
      attachments: [],
      replyTo: { providerMessageId: c.provider_message_id, providerThreadId: c.provider_thread_id, internetMessageId: c.internet_message_id },
    });
    const { data: msg } = await admin
      .from("email_messages")
      .insert({
        organization_id: organizationId,
        mail_connection_id: conn.id,
        project_id: project.id,
        consultation_id: c.id,
        direction: "outbound",
        kind: "followup",
        provider_message_id: sent.providerMessageId,
        provider_thread_id: sent.providerThreadId ?? c.provider_thread_id,
        internet_message_id: sent.internetMessageId,
        in_reply_to: c.internet_message_id,
        from_email: conn.email,
        to_emails: [supplier.email],
        subject,
        body_text: text,
        message_at: sent.sentAt,
      })
      .select("id")
      .single();
    const nextAttempt = opts.attempt + 1;
    const scheduleNext = c.auto_followup && nextAttempt <= MAX_AUTO_FOLLOWUPS;
    await admin
      .from("consultations")
      .update({ status: "relance", followup_count: c.followup_count + 1, last_followup_at: sent.sentAt })
      .eq("id", c.id);
    if (scheduleNext) {
      await admin.from("scheduled_followups").upsert(
        {
          organization_id: organizationId,
          consultation_id: c.id,
          attempt: nextAttempt,
          due_at: followupDueDate(new Date(sent.sentAt), nextAttempt).toISOString(),
          status: "scheduled",
        },
        { onConflict: "consultation_id,attempt", ignoreDuplicates: true },
      );
    }
    await logActivity({
      organizationId,
      projectId: project.id,
      consultationId: c.id,
      type: "followup_sent",
      message: `Relance envoyée à ${supplier.company_name}.`,
    });
    return { sent: true, emailMessageId: msg!.id };
  } catch (err) {
    if (err instanceof MailAuthError) {
      await markExpired(conn.id, err.message);
      throw new SendError(err.message);
    }
    throw err;
  }
}

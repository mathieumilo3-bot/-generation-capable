import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { euros } from "@/lib/format";
import { contentMatchesKind, fileKind, MAX_FILE_BYTES, MIME_BY_KIND, spreadsheetFormat, storagePath, sanitizeFileName } from "@/lib/files";
import { loadConnection, markExpired, providerFor } from "@/lib/mail/connections";
import { MailAuthError, type InboundMessage, type InboundSummary } from "@/lib/mail/types";
import { readWorkbook, workbookToText } from "@/lib/parsing/spreadsheet";
import { extractPdfText } from "@/lib/parsing/pdf";
import { parseFilledTemplate } from "@/lib/offers/template";
import { draftFromExtraction, type OfferDraft } from "@/lib/offers/draft";
import { extractOffer, type RequestedLine } from "@/lib/ai/tasks";
import { aiConfigured, AiFailure } from "@/lib/ai/llm";
import { matchOfferLines } from "@/lib/matching/match";
import { enqueue } from "@/lib/jobs/queue";
import { PermanentJobError } from "@/lib/jobs/runner";
import type { JsonValue } from "@/lib/supabase/json";
import { downloadFile, uploadFile } from "./storage";
import { referenceInSubject } from "./email-templates";
import { looksLikeAutoReply, looksLikeBounce, replyHead } from "@/lib/mail/reply-text";
import { cancelFollowups } from "./followups";

export type StoredFile = { name: string; path: string | null; mime: string; size: number; skipped?: string };

const AWAITING_OR_ANSWERED = ["envoye", "relance_prevue", "relance", "repondu", "reponse_partielle"];

type Resolution =
  | { kind: "consultation"; consultationId: string; projectId: string; supplierId: string; supplierName: string; method: "thread" | "header" | "reference" | "sender" }
  | { kind: "unassigned"; supplierId: string; supplierName: string }
  | null;

// ---------------------------------------------------------------------------
// Relève d'une boîte mail
// ---------------------------------------------------------------------------

export async function pollMailbox(connectionId: string) {
  const admin = adminClient();
  const { data: conn } = await admin.from("mail_connections").select("id, organization_id, status, last_polled_at").eq("id", connectionId).maybeSingle();
  if (!conn || conn.status === "expired") return;
  const full = await loadConnection(conn.id, conn.organization_id);
  if (!full) return;
  const startedAt = new Date();
  const floor = startedAt.getTime() - 30 * 86_400_000;
  const since = new Date(Math.max(floor, (conn.last_polled_at ? new Date(conn.last_polled_at).getTime() : floor) - 10 * 60_000));

  let summaries: InboundSummary[];
  try {
    summaries = await providerFor(full).listInbound(since);
  } catch (err) {
    if (err instanceof MailAuthError) {
      await markExpired(conn.id, err.message);
      return;
    }
    await admin.from("mail_connections").update({ last_error: "Relève de la boîte impossible, nouvel essai automatique." }).eq("id", conn.id);
    throw err;
  }

  const orgId = conn.organization_id;
  const { data: consultations } = await admin
    .from("consultations")
    .select("id, project_id, supplier_id, reference_code, provider_thread_id, mail_connection_id, status, suppliers(email, company_name)")
    .eq("organization_id", orgId)
    .not("status", "in", "(a_envoyer,annulee)")
    .gte("created_at", new Date(Date.now() - 180 * 86_400_000).toISOString());
  const { data: outbound } = await admin
    .from("email_messages")
    .select("consultation_id, internet_message_id")
    .eq("organization_id", orgId)
    .eq("direction", "outbound")
    .not("internet_message_id", "is", null);
  const { data: suppliers } = await admin.from("suppliers").select("id, email, company_name").eq("organization_id", orgId);

  const byId = new Map((consultations ?? []).map((c) => [c.id, c]));
  const toResolution = (c: NonNullable<typeof consultations>[number], method: "thread" | "header" | "reference" | "sender"): Resolution => ({
    kind: "consultation",
    consultationId: c.id,
    projectId: c.project_id,
    supplierId: c.supplier_id,
    supplierName: c.suppliers?.company_name ?? "Fournisseur",
    method,
  });

  const resolve = (s: InboundSummary): Resolution => {
    // 1. Identifiant de fil (Gmail threadId / Microsoft conversationId).
    const byThread = (consultations ?? []).find((c) => c.provider_thread_id && c.provider_thread_id === s.providerThreadId && c.mail_connection_id === conn.id);
    if (byThread) return toResolution(byThread, "thread");
    // 2. En-têtes In-Reply-To / References.
    const headers = `${s.inReplyTo ?? ""} ${s.references ?? ""}`;
    const byHeader = (outbound ?? []).find((m) => m.internet_message_id && headers.includes(m.internet_message_id));
    if (byHeader?.consultation_id && byId.has(byHeader.consultation_id)) return toResolution(byId.get(byHeader.consultation_id)!, "header");
    // 3. Référence PC-XXXXXX dans l'objet.
    const ref = referenceInSubject(s.subject);
    const byRef = ref ? (consultations ?? []).find((c) => c.reference_code === ref) : undefined;
    if (byRef) return toResolution(byRef, "reference");
    // 4. Expéditeur connu : uniquement s'il n'y a qu'une consultation possible.
    const supplier = (suppliers ?? []).find((x) => x.email.toLowerCase() === s.fromEmail);
    if (!supplier) return null;
    const candidates = (consultations ?? []).filter((c) => c.supplier_id === supplier.id && AWAITING_OR_ANSWERED.includes(c.status));
    if (candidates.length === 1) return toResolution(candidates[0], "sender");
    if (candidates.length > 1) return { kind: "unassigned", supplierId: supplier.id, supplierName: supplier.company_name };
    return null;
  };

  const provider = providerFor(full);
  for (const s of summaries) {
    const resolution = resolve(s);
    if (!resolution) continue; // message sans rapport avec une consultation : jamais stocké
    const { data: already } = await admin
      .from("email_messages")
      .select("id")
      .eq("mail_connection_id", conn.id)
      .eq("provider_message_id", s.providerMessageId)
      .maybeSingle();
    if (already) continue;
    const message = await provider.getMessage(s.providerMessageId);
    await ingestInbound(orgId, conn.id, message, resolution);
  }
  await admin.from("mail_connections").update({ last_polled_at: startedAt.toISOString(), last_error: null }).eq("id", conn.id);
}

async function storeAttachments(orgId: string, projectId: string | null, attachments: InboundMessage["attachments"]): Promise<StoredFile[]> {
  const files: StoredFile[] = [];
  for (const a of attachments) {
    const kind = fileKind(a.filename);
    if (!kind) {
      files.push({ name: a.filename, path: null, mime: a.contentType, size: a.size, skipped: "Format non analysé" });
      continue;
    }
    if (a.size > MAX_FILE_BYTES) {
      files.push({ name: a.filename, path: null, mime: a.contentType, size: a.size, skipped: "Fichier trop volumineux" });
      continue;
    }
    if (!contentMatchesKind(a.content, kind)) {
      files.push({ name: a.filename, path: null, mime: a.contentType, size: a.size, skipped: "Contenu invalide" });
      continue;
    }
    const path = projectId
      ? storagePath(orgId, projectId, "responses", a.filename)
      : `${orgId}/unassigned/responses/${crypto.randomUUID()}-${sanitizeFileName(a.filename)}`;
    await uploadFile(path, a.content, MIME_BY_KIND[kind]);
    files.push({ name: a.filename, path, mime: MIME_BY_KIND[kind], size: a.size });
  }
  return files;
}

async function ingestInbound(orgId: string, connectionId: string, m: InboundMessage, r: NonNullable<Resolution>) {
  const admin = adminClient();
  const projectId = r.kind === "consultation" ? r.projectId : null;
  const consultationId = r.kind === "consultation" ? r.consultationId : null;
  const files = await storeAttachments(orgId, projectId, m.attachments);
  const { data: email, error } = await admin
    .from("email_messages")
    .insert({
      organization_id: orgId,
      mail_connection_id: connectionId,
      project_id: projectId,
      consultation_id: consultationId,
      direction: "inbound",
      kind: "reply",
      provider_message_id: m.providerMessageId,
      provider_thread_id: m.providerThreadId,
      internet_message_id: m.internetMessageId,
      in_reply_to: m.inReplyTo,
      references_header: m.references,
      from_email: m.fromEmail,
      from_name: m.fromName,
      subject: m.subject,
      body_text: m.bodyText.slice(0, 100_000),
      attachments: files as JsonValue,
      message_at: m.receivedAt,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return; // déjà enregistré par une relève concurrente
    throw new Error(`Enregistrement du message impossible : ${error.message}`);
  }
  const bounce = r.kind === "consultation" && looksLikeBounce(m.fromEmail, m.subject);
  const autoReply = bounce || (looksLikeAutoReply(m.subject, m.bodyText) && !files.some((f) => f.path));
  const { data: response } = await admin
    .from("supplier_responses")
    .insert({
      organization_id: orgId,
      project_id: projectId,
      consultation_id: consultationId,
      supplier_id: r.supplierId,
      email_message_id: email.id,
      source: "email",
      match_method: r.kind === "consultation" ? r.method : null,
      status: r.kind === "unassigned" ? "needs_assignment" : autoReply ? "processed" : "pending",
      classification: autoReply ? "other" : null,
      files: files as JsonValue,
      received_at: m.receivedAt,
    })
    .select("id")
    .single();
  if (r.kind === "unassigned") {
    await logActivity({ organizationId: orgId, type: "response_unassigned", message: `Réponse de ${r.supplierName} à rattacher à une consultation.` });
    return;
  }
  if (bounce && r.kind === "consultation") {
    // Adresse en échec : plus aucune relance, l'utilisateur corrige puis renvoie.
    const message = `E-mail non remis à ${r.supplierName} : adresse injoignable. Corrigez l'adresse du fournisseur puis renvoyez la consultation.`;
    await admin
      .from("consultations")
      .update({ status: "erreur", error: message })
      .eq("id", r.consultationId)
      .in("status", ["envoye", "relance_prevue", "relance"]);
    await cancelFollowups(r.consultationId, "Adresse injoignable (e-mail non remis)");
    await logActivity({ organizationId: orgId, projectId, consultationId, type: "bounce", message });
    return;
  }
  if (autoReply) {
    await logActivity({ organizationId: orgId, projectId, consultationId, type: "auto_reply", message: `Réponse automatique de ${r.supplierName} (absence ou accusé de réception).` });
    return;
  }
  await logActivity({ organizationId: orgId, projectId, consultationId, type: "response_received", message: `${r.supplierName} a répondu.` });
  await enqueue("process_response", { responseId: response!.id }, { organizationId: orgId, dedupeKey: `response:${response!.id}` });
}

/** Import manuel d'une offre reçue hors messagerie (fichier déposé par l'utilisateur). */
export async function createManualResponse(orgId: string, consultationId: string, files: StoredFile[]) {
  const admin = adminClient();
  const { data: c } = await admin.from("consultations").select("id, project_id, supplier_id").eq("id", consultationId).eq("organization_id", orgId).single();
  const { data: response, error } = await admin
    .from("supplier_responses")
    .insert({
      organization_id: orgId,
      project_id: c!.project_id,
      consultation_id: c!.id,
      supplier_id: c!.supplier_id,
      source: "manual",
      match_method: "manual",
      status: "pending",
      files: files as JsonValue,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await enqueue("process_response", { responseId: response.id }, { organizationId: orgId, dedupeKey: `response:${response.id}` });
  return response.id;
}

// ---------------------------------------------------------------------------
// Analyse d'une réponse
// ---------------------------------------------------------------------------

export async function processResponse(responseId: string) {
  const admin = adminClient();
  const { data: resp } = await admin.from("supplier_responses").select("*").eq("id", responseId).maybeSingle();
  // Idempotence : une tâche rejouée (reprise après crash, doublon) ne relance jamais
  // l'analyse d'une réponse déjà traitée — un réessai explicite repasse d'abord en « pending ».
  if (!resp || !resp.consultation_id || !["pending", "processing", "failed"].includes(resp.status)) return;
  const orgId = resp.organization_id;
  const { data: c } = await admin
    .from("consultations")
    .select("id, project_id, supplier_id, reference_code, status, suppliers(company_name)")
    .eq("id", resp.consultation_id)
    .eq("organization_id", orgId)
    .single();
  if (!c) throw new PermanentJobError("Consultation introuvable");
  await admin.from("supplier_responses").update({ status: "processing", error: null }).eq("id", resp.id);
  const supplierName = c.suppliers?.company_name ?? "Fournisseur";

  const { data: cl } = await admin
    .from("consultation_lines")
    .select("position, project_lines(id, code, designation, quantity, unit)")
    .eq("consultation_id", c.id)
    .order("position");
  const requestedLines = (cl ?? []).map((x) => x.project_lines).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const requested: RequestedLine[] = requestedLines.map((l, i) => ({ key: `R${i + 1}`, code: l.code, designation: l.designation, quantity: l.quantity, unit: l.unit }));
  const keyToId = new Map(requestedLines.map((l, i) => [`R${i + 1}`, l.id]));

  let emailText: string | null = null;
  if (resp.email_message_id) {
    const { data: em } = await admin.from("email_messages").select("body_text").eq("id", resp.email_message_id).single();
    // L'analyse ne lit que ce que le fournisseur a écrit, pas notre demande citée en dessous.
    emailText = em?.body_text ? replyHead(em.body_text) : null;
  }

  const files = ((resp.files as unknown as StoredFile[]) ?? []).filter((f) => f.path && !f.skipped);
  let templateDraft: (OfferDraft & { referenceCode: string }) | null = null;
  const docs: ({ name: string; text: string } | { name: string; pdf: Buffer })[] = [];
  let sourceKind: OfferDraft["sourceKind"] = files.length ? "excel" : "email_body";
  for (const f of files) {
    const kind = fileKind(f.name);
    if (!kind) continue;
    const buffer = await downloadFile(f.path!);
    if (kind === "pdf") {
      const pdf = await extractPdfText(buffer);
      if (pdf.needsOcr) {
        docs.push({ name: f.name, pdf: buffer });
        sourceKind = "pdf_ocr";
      } else {
        docs.push({ name: f.name, text: pdf.pages.map((p, i) => `--- page ${i + 1} ---\n${p}`).join("\n") });
        if (sourceKind !== "pdf_ocr") sourceKind = "pdf";
      }
      continue;
    }
    const wb = readWorkbook(buffer, spreadsheetFormat(buffer, kind));
    const tpl = parseFilledTemplate(wb, f.name);
    if (tpl && tpl.referenceCode === c.reference_code) {
      templateDraft = tpl;
      continue;
    }
    docs.push({ name: f.name, text: workbookToText(wb).text });
    if (kind === "csv" && sourceKind === "excel") sourceKind = "csv";
  }

  const templatePriced = templateDraft?.lines.some((l) => l.unit_price !== null || l.total_price !== null) ?? false;
  let draft: OfferDraft;
  if (templateDraft && templatePriced && !docs.length) {
    draft = templateDraft;
  } else if (!aiConfigured()) {
    if (templateDraft) draft = templateDraft;
    else throw new PermanentJobError("Analyse automatique indisponible : consultez le devis joint.");
  } else {
    const extracted = await extractOffer({ requested, emailText, documents: docs, context: { organizationId: orgId, projectId: c.project_id } });
    const aiDraft = draftFromExtraction(extracted, sourceKind, () => docs[0]?.name ?? null);
    if (templateDraft && templatePriced) {
      // Fichier de consultation rempli + autre document : les prix du fichier font foi,
      // l'en-tête (validité, délai…) est complété par l'analyse du document.
      const header = { ...templateDraft.header };
      for (const [k, v] of Object.entries(aiDraft.header) as [keyof OfferDraft["header"], never][]) {
        const current = header[k];
        if (current === null || current === "unknown" || (Array.isArray(current) && !current.length)) header[k] = v;
      }
      draft = { ...templateDraft, header, classification: templateDraft.classification };
    } else draft = aiDraft;
  }

  if (draft.classification === "refusal") {
    await admin.from("consultations").update({ status: "refus", responded_at: new Date().toISOString() }).eq("id", c.id);
    await cancelFollowups(c.id, "Refus du fournisseur");
    await admin.from("supplier_responses").update({ status: "processed", classification: "refusal" }).eq("id", resp.id);
    await logActivity({ organizationId: orgId, projectId: c.project_id, consultationId: c.id, type: "refusal", message: `${supplierName} a décliné la consultation.` });
    return;
  }
  const pricedLines = draft.lines.filter((l) => l.unit_price !== null || l.total_price !== null);
  if (draft.classification === "other" || !pricedLines.length) {
    await admin.from("supplier_responses").update({ status: "processed", classification: "other" }).eq("id", resp.id);
    await logActivity({ organizationId: orgId, projectId: c.project_id, consultationId: c.id, type: "response_no_offer", message: `Message de ${supplierName} sans offre chiffrée.` });
    return;
  }

  const matches = matchOfferLines(
    requestedLines.map((l) => ({ id: l.id, code: l.code, designation: l.designation, quantity: l.quantity, unit: l.unit })),
    draft.lines.map((l) => ({
      supplier_reference: l.supplier_reference,
      supplier_designation: l.supplier_designation,
      quantity: l.quantity,
      is_fee: l.is_fee,
      exactProjectLineId: l.exactProjectLineId,
      aiMatchId: l.aiMatchKey ? (keyToId.get(l.aiMatchKey) ?? null) : null,
      aiMatchConfidence: l.aiMatchConfidence,
    })),
  );

  await admin.from("offers").update({ is_current: false }).eq("consultation_id", c.id).eq("is_current", true);
  const { data: offer, error: offerError } = await admin
    .from("offers")
    .insert({
      organization_id: orgId,
      project_id: c.project_id,
      consultation_id: c.id,
      supplier_id: c.supplier_id,
      supplier_response_id: resp.id,
      is_current: true,
      quote_reference: draft.header.quote_reference,
      quote_date: draft.header.quote_date,
      validity_date: draft.header.validity_date,
      delivery_delay: draft.header.delivery_delay,
      payment_terms: draft.header.payment_terms,
      delivery_cost: draft.header.delivery_cost,
      delivery_included: draft.header.delivery_included,
      commissioning_included: draft.header.commissioning_included,
      total_ht: draft.header.total_ht,
      currency: draft.header.currency,
      exclusions: draft.header.exclusions,
      reservations: draft.header.reservations,
      comments: draft.header.comments ?? draft.header.validity_text,
      source_kind: draft.sourceKind,
      confidence: draft.confidence,
      extraction: draft.extraction as JsonValue,
    })
    .select("id")
    .single();
  if (offerError) throw new Error(`Enregistrement de l'offre impossible : ${offerError.message}`);

  const rows = draft.lines.map((l, i) => ({
    organization_id: orgId,
    offer_id: offer.id,
    project_line_id: matches[i].projectLineId,
    position: i,
    match_status: matches[i].status,
    match_score: matches[i].score,
    match_method: matches[i].method,
    supplier_reference: l.supplier_reference,
    supplier_designation: l.supplier_designation,
    quantity: l.quantity,
    unit: l.unit,
    unit_price: l.unit_price,
    total_price: l.total_price,
    discount: l.discount,
    availability: l.availability,
    delivery_delay: l.delivery_delay,
    is_alternative: l.is_alternative,
    alternative_note: l.alternative_note,
    is_fee: l.is_fee,
    confidence: l.confidence,
    source: { ...l.source, duplicate_of: matches[i].duplicateOf ?? null } as JsonValue,
    original: l as JsonValue,
  }));
  if (rows.length) {
    const { error } = await admin.from("offer_lines").insert(rows);
    if (error) throw new Error(`Enregistrement des lignes d'offre impossible : ${error.message}`);
  }

  const covered = new Set(matches.filter((m) => m.projectLineId).map((m) => m.projectLineId));
  const partial = draft.classification === "partial" || covered.size < requestedLines.length;
  await admin
    .from("consultations")
    .update({ status: partial ? "reponse_partielle" : "repondu", responded_at: new Date().toISOString() })
    .eq("id", c.id);
  await cancelFollowups(c.id, "Réponse reçue");
  await admin.from("supplier_responses").update({ status: "processed", classification: partial ? "partial" : "offer" }).eq("id", resp.id);
  const total = draft.header.total_ht ?? pricedLines.reduce((n, l) => n + (l.total_price ?? 0), 0);
  await logActivity({
    organizationId: orgId,
    projectId: c.project_id,
    consultationId: c.id,
    type: "offer_extracted",
    message: `Offre de ${supplierName} analysée : ${euros(total)} HT${partial ? ` (${covered.size}/${requestedLines.length} lignes)` : ""}.`,
  });
}

export async function markResponseFailed(responseId: string, err: unknown) {
  const message =
    err instanceof PermanentJobError
      ? err.message
      : err instanceof AiFailure && !err.retryable
        ? `Nous n'avons pas réussi à analyser cette offre automatiquement : ${err.userMessage}`
        : "Nous n'avons pas réussi à analyser cette offre automatiquement.";
  const admin = adminClient();
  const { data } = await admin
    .from("supplier_responses")
    .update({ status: "failed", error: message })
    .eq("id", responseId)
    .select("organization_id, project_id, consultation_id")
    .maybeSingle();
  if (data) {
    await logActivity({ organizationId: data.organization_id, projectId: data.project_id, consultationId: data.consultation_id, type: "response_failed", message });
  }
}

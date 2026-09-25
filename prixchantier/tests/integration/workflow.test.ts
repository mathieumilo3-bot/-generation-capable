import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ExcelJS from "exceljs";
import { admin, createTenant, loadEnv } from "../support/local-supabase";
import { fakeStructured } from "../support/fake-llm";

/**
 * Parcours complet côté serveur, contre la vraie base et le vrai stockage :
 * analyse DPGF → consultations → envoi → réponses PDF / Excel / scan →
 * rattachement → extraction → trous → comparatif → export → relances.
 * Seuls la boîte mail (boîte de test sur disque) et le modèle IA (double
 * déterministe, revalidé par les schémas zod réels) sont simulés.
 */

loadEnv();
const mailDir = mkdtempSync(join(tmpdir(), "pc-mail-"));
process.env.TEST_MAILBOX_DIR = mailDir;
process.env.ENABLE_TEST_MAILBOX = "1";

const fixture = (name: string) => readFileSync(join(__dirname, "../fixtures/files", name));
const llmCalls: { name: string; hasPdf: boolean }[] = [];

type Tenant = Awaited<ReturnType<typeof createTenant>>;
let T: Tenant;
let projectId: string;
let connectionId: string;
const consultations: Record<"A" | "B" | "C" | "D", { id: string; ref: string; supplierEmail: string }> = {} as never;

// Modules serveur importés après la configuration de l'environnement.
let lib: {
  analyzeProject: typeof import("@/lib/workflows/analysis").analyzeProject;
  sendConsultation: typeof import("@/lib/workflows/sending").sendConsultation;
  sendFollowup: typeof import("@/lib/workflows/sending").sendFollowup;
  pollMailbox: typeof import("@/lib/workflows/responses").pollMailbox;
  processResponse: typeof import("@/lib/workflows/responses").processResponse;
  sendScheduledFollowup: typeof import("@/lib/workflows/followups").sendScheduledFollowup;
  loadComparison: typeof import("@/lib/comparison/load").loadComparison;
  buildComparisonWorkbook: typeof import("@/lib/export/comparison-xlsx").buildComparisonWorkbook;
  consultationSubject: typeof import("@/lib/workflows/email-templates").consultationSubject;
  newReferenceCode: typeof import("@/lib/workflows/email-templates").newReferenceCode;
};

beforeAll(async () => {
  const { setLlmForTests } = await import("@/lib/ai/llm");
  setLlmForTests({
    async structured(req) {
      const parts = typeof req.content === "string" ? [{ type: "text" as const, text: req.content }] : req.content;
      const text = parts.map((p) => (p.type === "text" ? p.text : "")).join("\n");
      const hasPdf = parts.some((p) => p.type === "pdf");
      llmCalls.push({ name: req.name, hasPdf });
      return req.schema.parse(fakeStructured(req.name, text, hasPdf));
    },
  });
  lib = {
    ...(await import("@/lib/workflows/analysis")),
    ...(await import("@/lib/workflows/sending")),
    ...(await import("@/lib/workflows/responses")),
    ...(await import("@/lib/workflows/followups")),
    ...(await import("@/lib/comparison/load")),
    ...(await import("@/lib/export/comparison-xlsx")),
    ...(await import("@/lib/workflows/email-templates")),
  };
  T = await createTenant("workflow");
});

afterAll(() => rmSync(mailDir, { recursive: true, force: true }));

function sentMessages() {
  const dir = join(mailDir, T.email.toLowerCase(), "sent");
  return readdirSync(dir).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

function deliver(msg: { id: string; threadId: string; inReplyTo?: string | null; from: string; subject: string; text: string; attachments?: { filename: string; contentType: string; content: Buffer }[] }) {
  const dir = join(mailDir, T.email.toLowerCase(), "inbox");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${msg.id}.json`),
    JSON.stringify({
      id: msg.id,
      threadId: msg.threadId,
      internetMessageId: `<${msg.id}@fournisseur.test>`,
      inReplyTo: msg.inReplyTo ?? null,
      references: msg.inReplyTo ?? null,
      from: msg.from,
      fromName: null,
      to: T.email,
      subject: msg.subject,
      text: msg.text,
      date: new Date().toISOString(),
      attachments: (msg.attachments ?? []).map((a) => ({ filename: a.filename, contentType: a.contentType, base64: a.content.toString("base64") })),
    }),
  );
}

describe("parcours complet (acceptance, côté serveur)", () => {
  it("1-5. crée un dossier et extrait un DPGF Excel de 73 lignes", async () => {
    const { data: p } = await T.client.from("projects").insert({ name: "Résidence Les Tilleuls", reference: "AO-2026-17" }).select("id").single();
    projectId = p!.id;
    const path = `${T.orgId}/${projectId}/source/${crypto.randomUUID()}-dpgf-standard.xlsx`;
    const up = await T.client.storage.from("files").upload(path, fixture("dpgf-standard.xlsx"));
    expect(up.error).toBeNull();
    await T.client.from("project_documents").insert({ project_id: projectId, kind: "dpgf", file_name: "DPGF Lot 10-11-12.xlsx", storage_path: path, size_bytes: 10762 });

    await lib.analyzeProject(projectId);

    const { data: project } = await T.client.from("projects").select("analysis_status, analysis_summary").eq("id", projectId).single();
    expect(project!.analysis_status).toBe("done");
    const { data: lines } = await T.client.from("project_lines").select("*").eq("project_id", projectId).order("position");
    expect(lines).toHaveLength(73);
    expect(lines![0]).toMatchObject({ code: "10.1.1", source_sheet: "DPGF", source_row: 9, category: "Production chaud/froid" });
    expect(lines!.find((l) => l.code === "10.1.7")).toMatchObject({ supplier_required: false, subcontractor_required: true });
    expect(llmCalls.filter((c) => c.name === "classement_lignes")).toHaveLength(1);
  });

  it("6. corrige une ligne sans perdre la valeur d'origine", async () => {
    const { data: line } = await T.client.from("project_lines").select("id, original").eq("project_id", projectId).eq("code", "10.2.1").single();
    await T.client.from("project_lines").update({ quantity: 130, user_modified: true, user_validated: true }).eq("id", line!.id);
    const { data: after } = await T.client.from("project_lines").select("quantity, original").eq("id", line!.id).single();
    expect(after!.quantity).toBe(130);
    expect((after!.original as { quantity: number }).quantity).toBe(120);
  });

  it("7-11. génère et envoie 4 consultations, IDs et fils enregistrés", async () => {
    const { data: conn } = await admin()
      .from("mail_connections")
      .insert({ organization_id: T.orgId, user_id: T.userId, provider: "test", email: T.email.toLowerCase(), last_polled_at: new Date(Date.now() - 60_000).toISOString() })
      .select("id")
      .single();
    connectionId = conn!.id;
    const { data: consulted } = await T.client
      .from("project_lines")
      .select("id, code")
      .eq("project_id", projectId)
      .in("code", [
        "10.2.1", "10.2.2", "10.2.3", "10.2.4", "10.2.5", "10.2.6", "10.2.7", "10.2.8", "10.2.9", "10.2.10", "10.2.11", "10.2.12",
        "10.3.1", "10.3.2", "10.3.3", "10.3.4", "10.3.5",
      ])
      .order("position");
    expect(consulted).toHaveLength(17);

    for (const [key, email] of [
      ["A", "commercial@fournisseur-a.test"],
      ["B", "devis@fournisseur-b.test"],
      ["C", "offres@fournisseur-i.test"],
      ["D", "contact@fournisseur-d.test"],
    ] as const) {
      const { data: s } = await T.client.from("suppliers").insert({ company_name: `Fournisseur ${key}`, email }).select("id").single();
      const ref = lib.newReferenceCode();
      const { data: c } = await T.client
        .from("consultations")
        .insert({
          project_id: projectId,
          supplier_id: s!.id,
          mail_connection_id: connectionId,
          reference_code: ref,
          subject: lib.consultationSubject({ projectName: "Résidence Les Tilleuls", projectReference: "AO-2026-17", referenceCode: ref }),
          body: "Bonjour,\n\nDans le cadre du chantier Résidence Les Tilleuls, pourriez-vous nous transmettre votre meilleure proposition ?\n\nBien cordialement.",
          auto_followup: true,
          created_by: T.userId,
        })
        .select("id")
        .single();
      await T.client.from("consultation_lines").insert(consulted!.map((l, i) => ({ consultation_id: c!.id, project_line_id: l.id, position: i })));
      consultations[key] = { id: c!.id, ref, supplierEmail: email };
      await lib.sendConsultation(c!.id, T.orgId);
    }

    const sent = sentMessages();
    expect(sent).toHaveLength(4);
    for (const m of sent) {
      expect(m.subject).toMatch(/\[PC-[A-Z0-9]{6}\]$/);
      expect(m.attachments).toHaveLength(1);
      expect(m.attachments[0].filename).toMatch(/^Demande de prix PC-.+\.xlsx$/);
    }
    const { data: rows } = await T.client.from("consultations").select("status, provider_message_id, provider_thread_id, internet_message_id, sent_at").eq("project_id", projectId);
    for (const r of rows!) {
      expect(r.status).toBe("relance_prevue");
      expect(r.provider_message_id && r.provider_thread_id && r.internet_message_id && r.sent_at).toBeTruthy();
    }
    const { data: emails } = await T.client.from("email_messages").select("direction, to_emails, attachments").eq("consultation_id", consultations.A.id);
    expect(emails![0]).toMatchObject({ direction: "outbound", to_emails: ["commercial@fournisseur-a.test"] });
    const { data: followups } = await T.client.from("scheduled_followups").select("attempt, status").eq("consultation_id", consultations.A.id);
    expect(followups).toEqual([{ attempt: 1, status: "scheduled" }]);
  });

  it("12-14. reçoit un PDF, un Excel rempli et un devis incomplet, et les rattache au bon dossier", async () => {
    const sent = sentMessages();
    const sentTo = (email: string) => sent.find((m) => m.to === email)!;

    // A : réponse dans le fil, devis PDF.
    const a = sentTo(consultations.A.supplierEmail);
    deliver({ id: "rep-a", threadId: a.threadId, inReplyTo: a.internetMessageId, from: consultations.A.supplierEmail, subject: `RE: ${a.subject}`, text: "Bonjour, veuillez trouver notre devis. Cordialement", attachments: [{ filename: "DV-2026-10452.pdf", contentType: "application/pdf", content: fixture("devis-fournisseur-a.pdf") }] });

    // B : renvoie NOTRE fichier Excel rempli, depuis un nouveau fil mais avec la référence dans l'objet.
    const b = sentTo(consultations.B.supplierEmail);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(b.attachments[0].base64, "base64") as never);
    const ws = wb.getWorksheet("Demande de prix")!;
    for (let r = 7; r < 7 + 17; r++) if (r !== 10) ws.getCell(`F${r}`).value = 5 + r; // ligne 10 laissée vide
    const filled = Buffer.from(await wb.xlsx.writeBuffer());
    deliver({ id: "rep-b", threadId: "autre-fil", from: consultations.B.supplierEmail, subject: `Votre demande ${consultations.B.ref}`, text: "Ci-joint complété.", attachments: [{ filename: "retour.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: filled }] });

    // C : devis incomplet, rattaché uniquement par l'expéditeur (aucun en-tête, aucune référence).
    deliver({ id: "rep-c", threadId: "fil-inconnu", from: consultations.C.supplierEmail, subject: "Offre", text: "Voici notre offre.", attachments: [{ filename: "OF-88213.pdf", contentType: "application/pdf", content: fixture("devis-incomplet.pdf") }] });

    // D : réponse automatique d'absence (ne doit pas stopper les relances).
    const d = sentTo(consultations.D.supplierEmail);
    deliver({ id: "rep-d", threadId: d.threadId, inReplyTo: d.internetMessageId, from: consultations.D.supplierEmail, subject: "Réponse automatique : absent", text: "Je suis absent jusqu'au 30." });

    // Message sans rapport : jamais stocké.
    deliver({ id: "spam", threadId: "x", from: "newsletter@pub.test", subject: "Promo", text: "..." });

    await lib.pollMailbox(connectionId);

    const { data: responses } = await T.client.from("supplier_responses").select("id, consultation_id, match_method, status, files").eq("project_id", projectId);
    const byConsultation = Object.fromEntries(responses!.map((r) => [r.consultation_id, r]));
    expect(byConsultation[consultations.A.id].match_method).toBe("thread");
    expect(byConsultation[consultations.B.id].match_method).toBe("reference");
    expect(byConsultation[consultations.C.id].match_method).toBe("sender");
    expect(byConsultation[consultations.D.id]).toMatchObject({ status: "processed" });
    const { count: spam } = await admin().from("email_messages").select("id", { count: "exact", head: true }).eq("from_email", "newsletter@pub.test");
    expect(spam).toBe(0);
    // Pièces jointes stockées dans /org/projet/responses/
    const files = byConsultation[consultations.A.id].files as { path: string }[];
    expect(files[0].path.startsWith(`${T.orgId}/${projectId}/responses/`)).toBe(true);

    // Relève idempotente : un second passage ne duplique rien.
    await lib.pollMailbox(connectionId);
    const { count } = await T.client.from("supplier_responses").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    expect(count).toBe(4);

    for (const r of responses!.filter((x) => x.status === "pending")) await lib.processResponse(r.id);
  });

  it("15-16. extrait les prix et identifie les lignes manquantes", async () => {
    const { data: rows } = await T.client.from("consultations").select("id, status").eq("project_id", projectId);
    const status = Object.fromEntries(rows!.map((r) => [r.id, r.status]));
    expect(status[consultations.A.id]).toBe("repondu");
    expect(status[consultations.B.id]).toBe("reponse_partielle");
    expect(status[consultations.C.id]).toBe("reponse_partielle");
    expect(status[consultations.D.id]).toBe("relance_prevue");

    const { data: offerA } = await T.client.from("offers").select("*, offer_lines(*)").eq("consultation_id", consultations.A.id).single();
    expect(offerA!.source_kind).toBe("pdf");
    expect(offerA!.commissioning_included).toBe("no");
    expect(offerA!.quote_reference).toBe("Devis n° DV-2026-10452");
    const matchedA = offerA!.offer_lines.filter((l) => l.project_line_id);
    expect(matchedA.length).toBe(17);
    expect(offerA!.offer_lines.every((l) => l.match_status === "matched")).toBe(true);

    const { data: offerB } = await T.client.from("offers").select("*, offer_lines(*)").eq("consultation_id", consultations.B.id).single();
    expect(offerB!.source_kind).toBe("template");
    expect(offerB!.offer_lines.filter((l) => l.unit_price !== null)).toHaveLength(16);
    expect(offerB!.offer_lines.every((l) => l.match_method === "template")).toBe(true);
    // Aucune IA pour un fichier de consultation rempli.
    expect(llmCalls.filter((c) => c.name === "offre_fournisseur")).toHaveLength(2);

    // Relances annulées pour ceux qui ont répondu, maintenues pour la réponse automatique.
    const { data: fA } = await T.client.from("scheduled_followups").select("status").eq("consultation_id", consultations.A.id);
    expect(fA![0].status).toBe("cancelled");
    const { data: fD } = await T.client.from("scheduled_followups").select("status").eq("consultation_id", consultations.D.id);
    expect(fD![0].status).toBe("scheduled");
  });

  it("17-19. comparatif : fournisseurs, totaux, offre incomplète signalée", async () => {
    const cmp = await lib.loadComparison(T.client, projectId);
    expect(cmp.lines).toHaveLength(17);
    const by = Object.fromEntries(cmp.suppliers.map((s) => [s.name, s]));
    expect(by["Fournisseur A"].total).toBeGreaterThan(0);
    expect(by["Fournisseur A"].missingCount).toBe(0);
    expect(by["Fournisseur B"].missingCount).toBe(1);
    expect(by["Fournisseur C"].missingCount).toBe(8);
    expect(by["Fournisseur C"].alerts.map((a) => a.code)).toEqual(expect.arrayContaining(["missing", "delivery"]));
    expect(by["Fournisseur A"].alerts.map((a) => a.code)).toContain("commissioning");
    expect(by["Fournisseur D"].hasOffer).toBe(false);
    expect(cmp.filters.missing.length).toBeGreaterThanOrEqual(8);
    expect(cmp.insights[0]).toMatch(/moins cher que .+, mais .*(absente|exclue|incluse)/);
    expect(cmp.insights.join(" ")).not.toMatch(/meilleur fournisseur/i);
  });

  it("20-21. génère un XLSX exploitable", async () => {
    const cmp = await lib.loadComparison(T.client, projectId);
    const buffer = await lib.buildComparisonWorkbook({ projectName: "Résidence Les Tilleuls", projectReference: "AO-2026-17", organizationName: "Entreprise", comparison: cmp });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Synthèse", "Comparatif", "Lignes manquantes", "Commentaires"]);
    const ws = wb.getWorksheet("Comparatif")!;
    expect(ws.getCell("A1").value).toBe("Lot");
    expect(ws.getCell("F1").value).toBe("Fournisseur A");
    expect(ws.getRow(2).getCell(6).value).toBe("PU HT");
    expect(ws.rowCount).toBe(2 + 17 + 2);
    const missing = wb.getWorksheet("Lignes manquantes")!;
    expect(missing.rowCount).toBeGreaterThanOrEqual(1 + 9);
    const syn = wb.getWorksheet("Synthèse")!;
    expect(syn.getCell("A6").value).toBe("Fournisseur A");
    expect(typeof syn.getCell("C6").value).toBe("number");
  });

  it("relances : envoyée dans le fil, jamais deux fois le même jour, jamais à qui a répondu", async () => {
    const { data: fD } = await admin().from("scheduled_followups").select("id").eq("consultation_id", consultations.D.id).single();
    await admin().from("scheduled_followups").update({ due_at: new Date(Date.now() - 1000).toISOString() }).eq("id", fD!.id);
    // L'e-mail initial est parti aujourd'hui : la règle « une par jour » bloque.
    await lib.sendScheduledFollowup(fD!.id);
    const { data: skipped } = await admin().from("scheduled_followups").select("status, reason").eq("id", fD!.id).single();
    expect(skipped).toMatchObject({ status: "skipped" });
    expect(skipped!.reason).toMatch(/aujourd'hui/);

    // Vieillit l'envoi initial de 2 jours : la relance part, dans le même fil.
    await admin().from("email_messages").update({ message_at: new Date(Date.now() - 2 * 86_400_000).toISOString() }).eq("consultation_id", consultations.D.id).eq("direction", "outbound");
    // La réponse automatique de D ne doit pas être prise pour une réponse.
    await admin().from("email_messages").delete().eq("consultation_id", consultations.D.id).eq("direction", "inbound");
    const res = await lib.sendFollowup(consultations.D.id, T.orgId, { attempt: 1, automatic: true });
    expect(res.sent).toBe(true);
    const followup = sentMessages().find((m) => m.subject.startsWith("Re:") && m.to === consultations.D.supplierEmail);
    expect(followup.inReplyTo).toMatch(/@test\.prixchantier>$/);
    expect(followup.text).toMatch(/Petite relance/);
    const { data: c } = await T.client.from("consultations").select("status, followup_count").eq("id", consultations.D.id).single();
    expect(c).toMatchObject({ status: "relance", followup_count: 1 });

    const again = await lib.sendFollowup(consultations.D.id, T.orgId, { attempt: 2, automatic: true });
    expect(again).toMatchObject({ sent: false });

    const answered = await lib.sendFollowup(consultations.A.id, T.orgId, { attempt: 1, automatic: false });
    expect(answered).toMatchObject({ sent: false });
  });

  it("fallback OCR : un devis scanné est transmis en lecture visuelle, et seulement lui", async () => {
    const { data: s } = await T.client.from("suppliers").insert({ company_name: "Fournisseur S", email: "scan@fournisseur-s.test" }).select("id").single();
    const ref = lib.newReferenceCode();
    const { data: c } = await T.client
      .from("consultations")
      .insert({ project_id: projectId, supplier_id: s!.id, mail_connection_id: connectionId, reference_code: ref, subject: `Demande [${ref}]`, body: "x", created_by: T.userId })
      .select("id")
      .single();
    const { data: lines } = await T.client.from("project_lines").select("id").eq("project_id", projectId).in("code", ["10.2.1", "10.2.2", "10.2.3"]);
    await T.client.from("consultation_lines").insert(lines!.map((l, i) => ({ consultation_id: c!.id, project_line_id: l.id, position: i })));
    await lib.sendConsultation(c!.id, T.orgId);
    deliver({ id: "rep-s", threadId: "t-s", from: "scan@fournisseur-s.test", subject: `Re: Demande [${ref}]`, text: "Devis scanné ci-joint", attachments: [{ filename: "scan.pdf", contentType: "application/pdf", content: fixture("devis-scanne.pdf") }] });
    const before = llmCalls.length;
    await lib.pollMailbox(connectionId);
    const { data: r } = await T.client.from("supplier_responses").select("id").eq("consultation_id", c!.id).single();
    await lib.processResponse(r!.id);
    expect(llmCalls.slice(before)).toEqual([{ name: "offre_fournisseur", hasPdf: true }]);
    const { data: offer } = await T.client.from("offers").select("source_kind, offer_lines(project_line_id)").eq("consultation_id", c!.id).single();
    expect(offer!.source_kind).toBe("pdf_ocr");
    expect(offer!.offer_lines.filter((l) => l.project_line_id).length).toBe(3);
  });

  it("22. aucune donnée de cette entreprise n'est visible par une autre", async () => {
    const other = await createTenant("intrus");
    for (const table of ["projects", "project_lines", "consultations", "offers", "offer_lines", "email_messages", "supplier_responses", "suppliers"] as const) {
      const { data } = await other.client.from(table).select("id");
      expect(data).toEqual([]);
    }
    const cmp = await lib.loadComparison(other.client, projectId);
    expect(cmp.suppliers).toEqual([]);
    expect(cmp.lines).toEqual([]);
  });
});

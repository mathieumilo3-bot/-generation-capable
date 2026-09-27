import "server-only";

import { adminClient } from "@/lib/supabase/admin";
import { defaultConnection } from "@/lib/mail/connections";
import { discoverSuppliersFromWeb } from "@/lib/ai/supplier-discovery";
import { consultationBody, consultationSubject, newReferenceCode } from "@/lib/workflows/email-templates";
import { sendConsultation, SendError } from "@/lib/workflows/sending";
import { logActivity } from "@/lib/activity";
import { PermanentJobError } from "@/lib/jobs/runner";

type Line = {
  id: string;
  position: number;
  code: string | null;
  designation: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  confidence: number | null;
  user_validated: boolean;
  supplier_required: boolean;
};

type Supplier = {
  id: string;
  company_name: string;
  email: string;
  categories: string[];
};

type RankedSupplier = {
  supplier: Supplier;
  score: number;
  matchedCodes: Set<string> | null;
  discovered: boolean;
};

export async function autoLaunchProject(projectId: string, opts: { dryRun?: boolean } = {}) {
  const admin = adminClient();

  const { data: project } = await admin
    .from("projects")
    .select("id, organization_id, name, reference, client, response_deadline, closed_at, created_by, analysis_status")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) throw new PermanentJobError("Dossier introuvable.");
  if (project.closed_at) return;
  if (project.analysis_status !== "done") throw new PermanentJobError("Le dossier n'est pas prêt pour le pilote automatique.");
  if (!project.created_by) throw new PermanentJobError("Utilisateur créateur introuvable.");

  // Idempotence : une relance du job ne doit jamais dupliquer des demandes déjà créées.
  const { count: existing } = await admin
    .from("consultations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .neq("status", "annulee");
  if (existing) return;

  const conn = await defaultConnection(project.organization_id, project.created_by);
  if (!conn || conn.status !== "active") {
    throw new PermanentJobError("Aucune boîte mail active pour lancer automatiquement les consultations.");
  }

  const [{ data: rawLines }, { data: initialSuppliers }, { data: user }, { data: organization }] = await Promise.all([
    admin
      .from("project_lines")
      .select("id, position, code, designation, quantity, unit, category, confidence, user_validated, supplier_required")
      .eq("project_id", projectId)
      .eq("supplier_required", true)
      .order("position"),
    admin
      .from("suppliers")
      .select("id, company_name, email, categories")
      .eq("organization_id", project.organization_id)
      .order("company_name"),
    admin.from("users").select("full_name").eq("id", project.created_by).maybeSingle(),
    admin.from("organizations").select("name").eq("id", project.organization_id).maybeSingle(),
  ]);

  const lines = (rawLines ?? []) as Line[];
  if (!lines.length) throw new PermanentJobError("Aucune ligne fournisseur détectée dans le dossier.");

  // Les lignes très incertaines ne doivent jamais déclencher seules un envoi autonome.
  const eligible = lines.filter((l) => l.user_validated || l.confidence === null || Number(l.confidence) >= 0.7);
  const skippedLines = lines.length - eligible.length;
  if (!eligible.length) {
    throw new PermanentJobError("Toutes les lignes du dossier nécessitent une vérification avant envoi.");
  }

  const specificCategories = new Set(
    eligible.map((l) => l.category).filter((x): x is string => Boolean(x) && x !== "Divers"),
  );

  const ranked: RankedSupplier[] = ((initialSuppliers ?? []) as Supplier[])
    .map((supplier) => ({
      supplier: { ...supplier, categories: supplier.categories ?? [] },
      score: (supplier.categories ?? []).filter((cat) => specificCategories.has(cat)).length,
      matchedCodes: null,
      discovered: false,
    }))
    .filter((x) => specificCategories.size > 0 && x.score > 0)
    .sort((a, b) => b.score - a.score || a.supplier.company_name.localeCompare(b.supplier.company_name));

  // Complète automatiquement le carnet avec des fournisseurs trouvés sur le web.
  if (ranked.length < 3) {
    const discovered = await discoverSuppliersFromWeb({
      projectName: project.name,
      projectReference: project.reference,
      categories: specificCategories.size ? [...specificCategories] : ["Divers"],
      lines: eligible.map((l) => ({
        code: l.code,
        designation: l.designation,
        quantity: l.quantity,
        unit: l.unit,
        category: l.category,
      })),
      limit: 3 - ranked.length,
    });

    if (opts.dryRun) {
      await logActivity({
        organizationId: project.organization_id,
        projectId,
        type: "autopilot_smoke",
        message: discovered.length
          ? `Test sourcing réussi : ${discovered.map((s) => `${s.company_name} <${s.email}>`).join(", ")}`
          : "Test sourcing terminé : aucun fournisseur vérifiable trouvé.",
      });
      return;
    }

    for (const candidate of discovered) {
      const categories = candidate.categories.filter(
        (cat) => specificCategories.size === 0 || specificCategories.has(cat),
      );
      const matchedCodes = new Set(candidate.matched_codes.map((code) => code.trim()).filter(Boolean));
      if (!matchedCodes.size) continue;

      const { data: existingSupplier } = await admin
        .from("suppliers")
        .select("id, company_name, email, categories")
        .eq("organization_id", project.organization_id)
        .ilike("email", candidate.email.trim())
        .maybeSingle();

      let supplier: Supplier | null = existingSupplier
        ? { ...existingSupplier, categories: existingSupplier.categories ?? [] }
        : null;

      if (!supplier) {
        const note =
          `Découvert automatiquement par PrixChantier. Site : ${candidate.website} · Source e-mail : ${candidate.source_url} · ${candidate.reason}`.slice(0, 2000);
        const { data: created, error } = await admin
          .from("suppliers")
          .insert({
            organization_id: project.organization_id,
            company_name: candidate.company_name,
            email: candidate.email.trim().toLowerCase(),
            categories: categories.length ? categories : [...specificCategories],
            notes: note,
          })
          .select("id, company_name, email, categories")
          .single();
        if (error || !created) continue;
        supplier = { ...created, categories: created.categories ?? [] };
      }

      if (ranked.some((x) => x.supplier.id === supplier!.id)) continue;
      ranked.push({
        supplier,
        score: Math.max(1, categories.length),
        matchedCodes,
        discovered: true,
      });
    }
  }

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.discovered) - Number(a.discovered) ||
      a.supplier.company_name.localeCompare(b.supplier.company_name),
  );
  ranked.splice(3);

  if (!ranked.length) throw new PermanentJobError("Aucun fournisseur pertinent n'a été trouvé.");

  const supplierNames: string[] = [];
  const failed: string[] = [];

  for (const { supplier, matchedCodes } of ranked) {
    const supplierCategories = new Set(supplier.categories ?? []);
    const selectedLines = eligible.filter((line) => {
      if (matchedCodes) return Boolean(line.code && matchedCodes.has(line.code));
      return Boolean(line.category && line.category !== "Divers" && supplierCategories.has(line.category));
    });
    if (!selectedLines.length) continue;

    let consultationId: string | null = null;
    let referenceCode = "";

    for (let attempt = 0; attempt < 5 && !consultationId; attempt++) {
      referenceCode = newReferenceCode();
      const { data, error } = await admin
        .from("consultations")
        .insert({
          organization_id: project.organization_id,
          project_id: projectId,
          supplier_id: supplier.id,
          mail_connection_id: conn.id,
          reference_code: referenceCode,
          status: "a_envoyer",
          response_due_date: project.response_deadline,
          include_excel: true,
          auto_followup: true,
          attached_document_ids: [],
          subject: consultationSubject({
            projectName: project.name,
            projectReference: project.reference,
            referenceCode,
          }),
          body: consultationBody({
            projectName: project.name,
            client: project.client,
            dueDate: project.response_deadline,
            lineCount: selectedLines.length,
            senderName: user?.full_name ?? "Équipe travaux",
            organizationName: organization?.name ?? "Entreprise",
            withExcel: true,
          }),
          created_by: project.created_by,
        })
        .select("id")
        .single();

      if (error && error.code !== "23505") {
        failed.push(supplier.company_name);
        break;
      }
      consultationId = data?.id ?? null;
    }

    if (!consultationId) continue;

    const { error: linesError } = await admin.from("consultation_lines").insert(
      selectedLines.map((line, index) => ({
        organization_id: project.organization_id,
        consultation_id: consultationId!,
        project_line_id: line.id,
        position: index,
      })),
    );

    if (linesError) {
      failed.push(supplier.company_name);
      await admin.from("consultations").delete().eq("id", consultationId);
      continue;
    }

    try {
      await sendConsultation(consultationId, project.organization_id);
      supplierNames.push(supplier.company_name);
    } catch (err) {
      failed.push(supplier.company_name);
      if (!(err instanceof SendError)) {
        console.error("[autopilot] envoi:", err instanceof Error ? err.message : err);
      }
    }
  }

  if (!supplierNames.length) {
    throw new Error("Aucune consultation n'a pu être envoyée automatiquement.");
  }

  await logActivity({
    organizationId: project.organization_id,
    projectId,
    type: "autopilot_launched",
    message:
      `Pilote automatique : ${supplierNames.length} consultation(s) envoyée(s) à ${supplierNames.join(", ")}` +
      (skippedLines ? ` · ${skippedLines} ligne(s) incertaine(s) ignorée(s)` : "") +
      (failed.length ? ` · échec : ${failed.join(", ")}` : ""),
  });
}

export async function markAutoLaunchFailed(projectId: string, err: unknown) {
  const admin = adminClient();
  const { data: project } = await admin
    .from("projects")
    .select("organization_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return;
  const message = err instanceof Error ? err.message : "Le pilote automatique n'a pas pu démarrer.";
  await logActivity({
    organizationId: project.organization_id,
    projectId,
    type: "autopilot_failed",
    message: `Pilote automatique en échec : ${message}`,
  });
}

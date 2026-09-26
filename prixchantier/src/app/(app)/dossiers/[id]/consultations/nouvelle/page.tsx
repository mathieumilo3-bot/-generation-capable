import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { NewConsultationForm } from "./new-consultation-form";

export const metadata = { title: "Créer une consultation — PrixChantier" };

export default async function NewConsultationPage({ params }: PageProps<"/dossiers/[id]/consultations/nouvelle">) {
  await requireSession();
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, name, response_deadline, closed_at").eq("id", id).maybeSingle();
  if (!project || project.closed_at) notFound();
  const [{ data: lines }, { data: suppliers }, { data: docs }, { data: existing }] = await Promise.all([
    supabase.from("project_lines").select("id, lot, code, designation, quantity, unit, category, supplier_required").eq("project_id", id).order("position"),
    supabase.from("suppliers").select("id, company_name, contact_name, email, categories").order("company_name"),
    supabase.from("project_documents").select("id, file_name, kind, size_bytes").eq("project_id", id).order("created_at"),
    supabase.from("consultations").select("supplier_id, status, consultation_lines(project_line_id)").eq("project_id", id).neq("status", "annulee"),
  ]);
  const sentTo: Record<string, string[]> = {};
  for (const c of existing ?? []) {
    for (const l of c.consultation_lines) (sentTo[l.project_line_id] ??= []).push(c.supplier_id);
  }
  return (
    <>
      <PageHeader
        back={{ href: `/dossiers/${id}?tab=consultations`, label: project.name }}
        title="Créer une consultation"
        description="Choisissez les lignes à chiffrer et les fournisseurs à consulter. Rien ne part sans votre validation."
      />
      <NewConsultationForm
        projectId={id}
        defaultDueDate={project.response_deadline}
        lines={lines ?? []}
        suppliers={suppliers ?? []}
        documents={docs ?? []}
        sentTo={sentTo}
      />
    </>
  );
}

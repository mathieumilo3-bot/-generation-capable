import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/page";
import { LinesEditor, type EditorLine } from "./lines-editor";

export async function LinesTab({ projectId, closed }: { projectId: string; closed: boolean }) {
  const supabase = await createClient();
  const [{ data: lines }, { data: used }] = await Promise.all([
    supabase
      .from("project_lines")
      .select("id, lot, code, designation, description, quantity, unit, category, supplier_required, subcontractor_required, confidence, user_validated, user_modified, original, source_document, source_sheet, source_row, source_page")
      .eq("project_id", projectId)
      .order("position"),
    supabase.from("consultation_lines").select("project_line_id, consultations!inner(project_id)").eq("consultations.project_id", projectId),
  ]);
  if (!lines?.length) {
    return (
      <EmptyState
        title="Aucune ligne pour l'instant"
        description="Les lignes apparaissent ici après l'analyse du DPGF. Vous pouvez aussi les saisir à la main."
        action={closed ? undefined : <LinesEditor projectId={projectId} lines={[]} usedIds={[]} closed={closed} />}
      />
    );
  }
  const usedIds = [...new Set((used ?? []).map((u) => u.project_line_id))];
  return <LinesEditor projectId={projectId} lines={lines as EditorLine[]} usedIds={usedIds} closed={closed} />;
}

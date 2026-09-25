import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadComparison } from "@/lib/comparison/load";
import { buildComparisonWorkbook } from "@/lib/export/comparison-xlsx";
import { enforceRateLimit } from "@/lib/rate-limit";
import { storagePath } from "@/lib/files";
import { uploadFile } from "@/lib/workflows/storage";
import { logActivity } from "@/lib/activity";

export const maxDuration = 60;

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Export XLSX du comparatif. Les données sont lues sous la session de l'utilisateur (RLS). */
export async function GET(_: NextRequest, ctx: RouteContext<"/api/projects/[id]/export">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalide" }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  try {
    await enforceRateLimit("export", auth.user.id);
  } catch {
    return NextResponse.json({ error: "Trop d'exports, patientez quelques minutes." }, { status: 429 });
  }
  const { data: project } = await supabase.from("projects").select("id, name, reference, organization_id, organizations(name)").eq("id", id).maybeSingle();
  if (!project) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const comparison = await loadComparison(supabase, id);
  const buffer = await buildComparisonWorkbook({
    projectName: project.name,
    projectReference: project.reference,
    organizationName: project.organizations?.name ?? "",
    comparison,
  });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Comparatif ${project.name} ${date}.xlsx`.replace(/[\\/:*?"<>|]+/g, "-");
  // Copie archivée dans /organization_id/project_id/exports/
  await uploadFile(storagePath(project.organization_id, project.id, "exports", filename), buffer, XLSX).catch((e) =>
    console.error("[export] archivage:", e instanceof Error ? e.message : e),
  );
  await logActivity({ organizationId: project.organization_id, projectId: id, type: "export", message: "Comparatif exporté (XLSX)." });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="comparatif-${date}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

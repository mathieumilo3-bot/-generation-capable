import { NextResponse } from "next/server";
import { PIPELINE_STAGES, STAGE_LABEL_FR } from "@video-editor/shared-types";
import { getDb } from "@/server/db";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const db = getDb();
  const project = db.getProject(id);
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const stagesByName = db.latestStagesForProject(id);
  const stages = PIPELINE_STAGES.map((stage) => {
    const row = stagesByName[stage];
    return {
      stage,
      label: STAGE_LABEL_FR[stage],
      status: (row?.status as string) ?? "pending",
      error: (row?.error as string | null) ?? null,
    };
  });

  let result: unknown = null;
  if (project.status === "ready") {
    const renders = db.listRendersByProject(id);
    const finalRender = [...renders].reverse().find((r) => r.kind === "final" && r.status === "done");
    const proxyRender = [...renders].reverse().find((r) => r.kind === "proxy" && r.status === "done");
    const qcReport = proxyRender ? db.getQcReportForRender(proxyRender.id) : null;
    result = {
      videoUrl: finalRender ? `/api/projects/${id}/video` : null,
      qcReport,
    };
  }

  return NextResponse.json({ project, stages, result });
}

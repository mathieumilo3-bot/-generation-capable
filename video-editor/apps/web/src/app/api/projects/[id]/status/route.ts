import { NextResponse } from "next/server";
import { PIPELINE_STAGES, STAGE_LABEL_FR } from "@video-editor/shared-types";
import { getDb } from "@/server/db";
import { getProjectQueueJob } from "@/server/jobs";
import { getCurrentUserId } from "@/server/auth";

export const runtime = "nodejs";

// Next.js 14 : params est un objet simple, pas une Promise (Next 15).
export async function GET(_request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const { id } = params;

  // Authentification requise
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  const db = getDb();
  const project = db.getProject(id);
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  // Vérification d'ownership
  if (project.userId !== userId) {
    return NextResponse.json({ error: "Accès refusé à ce projet." }, { status: 403 });
  }

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

  // Progression réelle issue de la queue (§9, §26) : % global, étape
  // lisible, ETA honnête, tentatives. Jamais un pourcentage simulé.
  const job = getProjectQueueJob(id);
  const queue = job
    ? {
        status: job.status,
        progress: job.progress,
        currentStage: job.currentStage ?? null,
        estimatedRemainingMs: job.estimatedRemainingMs ?? null,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        workerId: job.workerId ?? null,
        profile: job.profile,
      }
    : null;

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

  return NextResponse.json({ project, stages, queue, result });
}

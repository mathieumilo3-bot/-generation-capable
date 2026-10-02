import { buildDailyBriefing } from "@gc-ai-os/executive-brain";
import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

export const maxDuration = 120;

/**
 * Briefing exécutif du jour : note d'entreprise, priorité arbitrée,
 * constat de chaque Executive Brain, et lacunes d'instrumentation.
 */
export async function GET() {
  const { metrics } = getRuntime();
  const briefing = await buildDailyBriefing(metrics);

  return NextResponse.json({
    date: briefing.date,
    score: briefing.score,
    priority: briefing.priority,
    arbitration: {
      rationale: briefing.arbitration.rationale,
      winner: briefing.arbitration.winner
        ? {
            title: briefing.arbitration.winner.proposal.title,
            rationale: briefing.arbitration.winner.proposal.rationale,
            brainId: briefing.arbitration.winner.proposal.brainId,
            executionDomain: briefing.arbitration.winner.proposal.executionDomain,
            score: briefing.arbitration.winner.score,
            explanation: briefing.arbitration.winner.explanation,
          }
        : null,
      contested: briefing.arbitration.contested.map((c) => ({
        title: c.proposal.title,
        score: c.score,
        brainId: c.proposal.brainId,
      })),
      ranked: briefing.arbitration.ranked.slice(0, 8).map((c) => ({
        title: c.proposal.title,
        brainId: c.proposal.brainId,
        score: c.score,
        explanation: c.explanation,
      })),
    },
    reports: briefing.reports.map((report) => ({
      brainId: report.brainId,
      label: report.label,
      coverage: report.coverage,
      assessment: report.assessment,
      proposalCount: report.proposals.length,
    })),
    instrumentationGaps: briefing.instrumentationGaps,
  });
}

interface RecordBody {
  metricId?: string;
  value?: number;
}

/**
 * Enregistre manuellement une valeur de métrique. Sert à alimenter le
 * système en attendant les connecteurs (source `manual`, jamais
 * présentée comme automatique).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RecordBody | null;
  const metricId = body?.metricId?.trim();

  if (!metricId || typeof body?.value !== "number" || !Number.isFinite(body.value)) {
    return NextResponse.json(
      { error: "Les champs « metricId » (texte) et « value » (nombre) sont requis." },
      { status: 400 },
    );
  }

  const { metrics } = getRuntime();
  if (!metrics.get(metricId)) {
    return NextResponse.json(
      { error: `Métrique inconnue : ${metricId}. Voir le catalogue via GET /api/executive.` },
      { status: 404 },
    );
  }

  await metrics.record(metricId, body.value, "manual");
  return NextResponse.json({ ok: true, reading: await metrics.read(metricId) });
}

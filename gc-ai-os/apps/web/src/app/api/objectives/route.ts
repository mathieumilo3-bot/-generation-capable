import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

export const maxDuration = 300;

export async function GET() {
  const { goalStore } = getRuntime();
  const objectives = await goalStore.list();
  return NextResponse.json({ objectives });
}

interface CreateBody {
  title?: string;
  statement?: string;
  horizon?: "annual" | "quarterly" | "monthly" | "weekly" | "daily";
  /** Si vrai, l'objectif est planifié ET exécuté dans la foulée. */
  execute?: boolean;
}

/**
 * Crée un objectif, le planifie, et — si demandé — l'exécute.
 *
 * Planification et exécution sont deux appels distincts par défaut :
 * engager du budget sur un plan qu'aucun humain n'a relu doit être un
 * choix explicite, pas le comportement implicite (voir
 * docs/gc-ai-os/10-moteur-objectifs.md).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const title = body?.title?.trim();

  if (!title) {
    return NextResponse.json({ error: "Le champ « title » est requis." }, { status: 400 });
  }

  const { goalEngine, goalStore } = getRuntime();

  const defined = await goalEngine.defineObjective({
    title,
    statement: body?.statement?.trim() || title,
    ...(body?.horizon ? { horizon: body.horizon } : {}),
  });

  if (!body?.execute) {
    return NextResponse.json({
      objective: defined.objective,
      missions: defined.missions,
      planSource: defined.planSource,
      executed: false,
    });
  }

  const result = await goalEngine.pursue(defined.objective.id);
  const decisions = await goalStore.listDecisionsForObjective(defined.objective.id);

  return NextResponse.json({
    objective: result.objective,
    missions: result.missions,
    deliverables: result.deliverables.map(({ content, ...meta }) => ({
      ...meta,
      preview: content.slice(0, 240),
    })),
    decisions,
    planSource: defined.planSource,
    halted: result.halted,
    haltReason: result.haltReason,
    executed: true,
  });
}

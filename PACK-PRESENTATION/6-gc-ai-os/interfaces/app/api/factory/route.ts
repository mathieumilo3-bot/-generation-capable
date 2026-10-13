import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

export async function GET() {
  const { goalStore } = getRuntime();
  const agents = await goalStore.listAll();
  return NextResponse.json({ agents });
}

interface ManufactureBody {
  description?: string;
  industry?: string;
}

/**
 * Fabrique un nouvel employé IA : Designer → Builder → Trainer →
 * Evaluator → Publisher (voir docs/gc-ai-os/11-factory.md).
 *
 * L'agent produit n'est actif qu'au prochain démarrage du runtime : il
 * est chargé depuis la base au bootstrap. Ce délai est volontaire —
 * injecter un agent à chaud dans un registre déjà servi rendrait l'état
 * du système dépendant de l'ordre des requêtes.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ManufactureBody | null;
  const description = body?.description?.trim();

  if (!description) {
    return NextResponse.json({ error: "Le champ « description » est requis." }, { status: 400 });
  }

  const { factory } = getRuntime();
  const outcome = await factory.manufacture({
    description,
    ...(body?.industry ? { industry: body.industry } : {}),
  });

  if (!outcome.ok) {
    return NextResponse.json(
      {
        ok: false,
        stage: outcome.stage,
        issues: outcome.issues,
        message:
          outcome.stage === "evaluate"
            ? "Agent enregistré comme candidat : il n'a pas passé l'évaluation et n'est donc pas publié."
            : "Blueprint rejeté par la validation de schéma.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    agent: outcome.agent,
    message:
      "Agent publié. Il sera actif au prochain démarrage du serveur (rechargement du registre).",
  });
}

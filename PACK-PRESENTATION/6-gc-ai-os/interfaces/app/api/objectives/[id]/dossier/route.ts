import { buildDossier } from "@gc-ai-os/goals";
import { getRuntime } from "@/server/runtime";

/**
 * Renvoie le dossier complet d'un objectif en Markdown, en pièce
 * jointe téléchargeable. C'est la sortie tangible du moteur
 * d'objectifs : un fichier exploitable, pas une réponse de chat.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { goalStore } = getRuntime();

  const objective = await goalStore.get(id);
  if (!objective) {
    return new Response("Objectif introuvable.", { status: 404 });
  }

  const [keyResults, missions, deliverables, decisions] = await Promise.all([
    goalStore.listForObjective(id),
    goalStore.listMissionsForObjective(id),
    goalStore.listDeliverablesForObjective(id),
    goalStore.listDecisionsForObjective(id),
  ]);

  const markdown = buildDossier({ objective, keyResults, missions, deliverables, decisions });
  const filename = `${slugify(objective.title) || "objectif"}-dossier.md`;

  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

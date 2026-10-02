import { getRuntime } from "@/server/runtime";

/** Télécharge un livrable individuel produit par une mission. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { goalStore } = getRuntime();

  const deliverable = await goalStore.getDeliverable(id);
  if (!deliverable) {
    return new Response("Livrable introuvable.", { status: 404 });
  }

  return new Response(deliverable.content, {
    headers: {
      "content-type": `${deliverable.mediaType}; charset=utf-8`,
      "content-disposition": `attachment; filename="${deliverable.filename}"`,
    },
  });
}

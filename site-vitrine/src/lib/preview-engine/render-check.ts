import { blueprintSchema } from "./blueprint-schema";
import type { PreviewDocument } from "./public-view";

/**
 * Structural render check run by the pipeline before a preview is declared
 * ready: the blueprint parses, and every section it lists has the material
 * the renderer needs. The React renderer itself is exercised against the
 * same documents in the unit tests (`PreviewSite.test.tsx`).
 */
export function checkRenderable(doc: PreviewDocument): { bytes: number; sections: number } {
  const blueprint = blueprintSchema.parse(doc.blueprint);
  if (blueprint.sections.at(-1)?.type !== "cta") throw new Error("render: the quote CTA must close the page");
  if (blueprint.hero.imageAssetId && !doc.assets[blueprint.hero.imageAssetId]) throw new Error("render: hero image missing");
  for (const section of blueprint.sections) {
    if (section.type === "services" && !blueprint.services.items.some((i) => doc.services[i.serviceId])) throw new Error("render: services empty");
    if (section.type === "portfolio" && blueprint.portfolio.assetIds.filter((id) => doc.assets[id]).length < 2) throw new Error("render: portfolio empty");
    if (section.type === "area" && !blueprint.area) throw new Error("render: area empty");
    if (section.type === "about" && !blueprint.about) throw new Error("render: about empty");
  }
  for (const asset of Object.values(doc.assets)) {
    if (!asset.src.startsWith("/api/preview/image?")) throw new Error("render: asset not proxied");
  }
  return { bytes: JSON.stringify(doc).length, sections: blueprint.sections.length + 1 };
}

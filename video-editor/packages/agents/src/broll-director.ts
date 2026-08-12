import type { Db } from "@video-editor/db";
import type { EditBlueprint } from "@video-editor/shared-types";

/**
 * Agent 05 — B-roll / Media Director. Ordre de priorité strict imposé
 * par le brief (§5) : médias fournis par l'utilisateur → bibliothèque
 * stock → génération IA. La génération n'existe pas dans ce MVP —
 * l'interface `TtvProvider` existe déjà (packages/model-router/src/ttv.ts)
 * pour l'ajouter plus tard sans changer cet agent.
 *
 * Portée MVP : résout les slots en métadonnées (quel média stock
 * correspond) — l'insertion visuelle dans le rendu final n'est pas
 * encore câblée (voir la note dans editor.ts). Un slot non résolu est
 * simplement laissé de côté au rendu, jamais un blocage du pipeline.
 */
export function runBrollDirector(db: Db, editBlueprint: EditBlueprint): EditBlueprint {
  const resolvedSlots = editBlueprint.brollSlots.map((slot) => {
    const keywords = slot.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    let bestMatch: { id: string; storagePath: string } | null = null;
    for (const kw of keywords) {
      const matches = db.listStockMediaByTag(kw);
      if (matches.length > 0) {
        bestMatch = matches[0]!;
        break;
      }
    }
    if (!bestMatch) return slot;
    return { ...slot, resolvedSource: "stock" as const, resolvedMediaId: bestMatch.id };
  });
  return { ...editBlueprint, brollSlots: resolvedSlots };
}

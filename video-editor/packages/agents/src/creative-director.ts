import type { BriefSpec, EditBlueprint, StyleProfile } from "@video-editor/shared-types";

export interface CreativeReview {
  ok: boolean;
  notes: string[];
}

/**
 * Agent 08 — Creative Director. Revue de cohérence AVANT le premier
 * rendu (pipeline §8 : creative_review précède proxy_render) — donc sans
 * coût de rendu. Vérifications déterministes toujours actives ; un appel
 * LLM optionnel ajoute un jugement qualitatif en plus, jamais à la place.
 */
export function runCreativeDirector(editBlueprint: EditBlueprint, styleProfile: StyleProfile, brief: BriefSpec): CreativeReview {
  const notes: string[] = [];
  let ok = true;

  // On ne compare la durée qu'à une cible RÉELLE (demandée ou dérivée du
  // contenu). Sans cible, la durée du montage est légitime par construction
  // (elle vient du contenu) — pas de fausse alerte "trop éloignée de 45s".
  if (brief.targetDurationSec != null) {
    const durationRatio = editBlueprint.totalDurationSec / brief.targetDurationSec;
    if (durationRatio < 0.6 || durationRatio > 1.4) {
      ok = false;
      notes.push(
        `Durée totale (${editBlueprint.totalDurationSec.toFixed(1)}s) trop éloignée de la cible (${brief.targetDurationSec.toFixed(1)}s).`
      );
    }
  }

  const hookClip = editBlueprint.clips.find((c) => c.role === "hook");
  if (!hookClip) {
    ok = false;
    notes.push("Aucun plan hook identifié dans la timeline.");
  } else if (hookClip.outDuration > styleProfile.hookDuration * 1.8) {
    notes.push("Le hook est plus long que le style demandé ne le suggère.");
  }

  const zoomCount = editBlueprint.clips.filter((c) => c.zoomKeyframes.length > 0).length;
  const expectedZoomCount = Math.round(editBlueprint.clips.length * styleProfile.zoomFrequency);
  if (Math.abs(zoomCount - expectedZoomCount) > Math.max(2, expectedZoomCount)) {
    notes.push(`Fréquence de zoom (${zoomCount} plans) éloignée du style demandé (~${expectedZoomCount}).`);
  }

  if (editBlueprint.brollSlots.length > 0) {
    const resolved = editBlueprint.brollSlots.filter((s) => s.resolvedSource !== null).length;
    if (resolved === 0) {
      notes.push("Aucun B-roll résolu — bibliothèque stock vide ou requêtes sans correspondance.");
    }
  }

  return { ok, notes };
}

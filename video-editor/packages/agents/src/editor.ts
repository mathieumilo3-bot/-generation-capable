import {
  newId,
  EditBlueprintSchema,
  validateTimelineClipAgainstSegment,
  type BriefSpec,
  type BrollSlot,
  type EditBlueprint,
  type Segment,
  type StoryBlueprint,
  type StyleProfile,
  type TimelineClip,
} from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import { computeClipOutDuration, planZoomIndices, planBrollIndices, transitionForClip, zoomScaleForRole } from "./rhythm-engine.js";

/**
 * Agent 04 — Editor. 100% déterministe, jamais un appel LLM (§5 et §22 du
 * brief produit : "le LLM décide l'intention [déjà fait par le Story
 * Director], le moteur détermine les paramètres exécutables"). Traduit
 * le StoryBlueprint en EditBlueprint exécutable par packages/render.
 *
 * Portée MVP assumée : les slots B-roll sont résolus en métadonnées
 * (Agent 05) et comptent dans le score QC, mais ne sont pas encore
 * insérés visuellement dans la timeline rendue (packages/render/assemble
 * ne les splice pas) — les intégrer correctement demanderait de réserver
 * leur durée dans le calcul de `timelineStart` pour ne pas désynchroniser
 * sous-titres et zooms, laissé explicitement à l'itération suivante (voir
 * README, section "Ce qui reste à faire").
 */
export function runEditor(
  db: Db,
  projectId: string,
  storyBlueprint: StoryBlueprint,
  segmentsById: Map<string, Segment>,
  styleProfile: StyleProfile,
  brief: BriefSpec,
  version: number
): EditBlueprint {
  const ordered: { role: TimelineClip["role"]; segment: Segment }[] = [];
  for (const beat of storyBlueprint.beats) {
    for (const segId of beat.segmentIds) {
      const segment = segmentsById.get(segId);
      if (!segment) throw new Error(`Segment ${segId} référencé par le blueprint narratif introuvable.`);
      ordered.push({ role: beat.role, segment });
    }
  }
  if (ordered.length === 0) throw new Error("Blueprint narratif vide — aucun plan à monter.");

  let clips: TimelineClip[] = [];
  let cursor = 0;
  for (let i = 0; i < ordered.length; i++) {
    const { role, segment } = ordered[i]!;
    const segmentDuration = segment.end - segment.start;
    const outDuration = computeClipOutDuration({ role, segmentDurationSec: segmentDuration, styleProfile });
    const clip: TimelineClip = {
      id: newId("clip"),
      segmentId: segment.id,
      rushId: segment.rushId,
      sourceStart: segment.start,
      sourceEnd: Math.min(segment.end, segment.start + outDuration),
      timelineStart: cursor,
      outDuration,
      zoomKeyframes: [],
      transitionIn: transitionForClip(i, styleProfile),
      role,
    };
    validateTimelineClipAgainstSegment(clip, segment);
    clips.push(clip);
    cursor += outDuration;
  }

  // Respect du budget de durée cible : durée demandée, sinon dérivée du
  // contenu réellement présent (jamais 45s inventé, §3/§24). On coupe la
  // queue plutôt que de dépasser, on NE rallonge jamais artificiellement.
  const orderedContentSec = ordered.reduce((sum, o) => sum + (o.segment.end - o.segment.start), 0);
  const target = brief.targetDurationSec ?? orderedContentSec;
  const maxDurationSec = target * 1.3;
  if (cursor > maxDurationSec) {
    let acc = 0;
    const trimmed: TimelineClip[] = [];
    for (const clip of clips) {
      if (acc + clip.outDuration > maxDurationSec && trimmed.length > 0) break;
      trimmed.push({ ...clip, timelineStart: acc });
      acc += clip.outDuration;
    }
    clips = trimmed;
    cursor = acc;
  }

  const zoomIndices = planZoomIndices(clips.length, styleProfile.zoomFrequency);
  clips = clips.map((clip, i) =>
    zoomIndices.has(i) ? { ...clip, zoomKeyframes: [{ atSec: 0, scale: zoomScaleForRole(clip.role), focusX: 0.5, focusY: 0.5 }] } : clip
  );

  const brollIndices = planBrollIndices(
    clips.map((c) => {
      const seg = segmentsById.get(c.segmentId)!;
      return { visualQuality: seg.visualQuality, narrativeInterest: seg.narrativeInterest };
    }),
    styleProfile.brollDensity
  );
  const brollSlots: BrollSlot[] = brollIndices.map((i) => {
    const clip = clips[i]!;
    const seg = segmentsById.get(clip.segmentId)!;
    const words = seg.transcript.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
    return {
      id: newId("broll"),
      afterClipId: clip.id,
      timelineStart: clip.timelineStart,
      durationSec: Math.min(1.5, clip.outDuration),
      query: words || `b-roll ${clip.role}`,
      resolvedSource: null,
      resolvedMediaId: null,
    };
  });

  const blueprint: EditBlueprint = EditBlueprintSchema.parse({
    id: newId("edit"),
    projectId,
    storyBlueprintId: storyBlueprint.id,
    version,
    styleProfileId: styleProfile.id,
    clips,
    brollSlots,
    captions: [],
    music: null,
    totalDurationSec: cursor,
  });
  db.saveEditBlueprint(blueprint);
  return blueprint;
}

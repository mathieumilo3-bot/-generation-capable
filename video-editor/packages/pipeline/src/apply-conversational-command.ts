import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  CONVERSATIONAL_COMMANDS,
  type ConversationalCommand,
  type EditBlueprint,
  type Segment,
} from "@video-editor/shared-types";
import type { Db } from "@video-editor/db";
import { assembleFromBlueprint, resolveStorageRoot } from "@video-editor/render";

export const IMPLEMENTED_COMMANDS: ConversationalCommand[] = ["shorter", "faster", "slower", "more_zooms", "less_zooms"];

export interface ApplyCommandResult {
  ok: boolean;
  videoUrl?: string;
  warnings?: string[];
  error?: string;
}

/**
 * Édition conversationnelle V1 (§15 du brief) : menu FERMÉ, chaque
 * commande une transformation déterministe du blueprint, puis un
 * re-rendu PARTIEL (pas tout le pipeline, pas l'Agent 09) pour rester
 * rapide. Les commandes non câblées répondent honnêtement plutôt que de
 * simuler un effet — voir IMPLEMENTED_COMMANDS.
 */
export async function applyConversationalCommand(db: Db, projectId: string, command: string): Promise<ApplyCommandResult> {
  if (!CONVERSATIONAL_COMMANDS.includes(command as ConversationalCommand)) {
    return { ok: false, error: `Commande inconnue: ${command}` };
  }
  const typedCommand = command as ConversationalCommand;

  const project = db.getProject(projectId);
  if (!project) return { ok: false, error: "Projet introuvable." };

  const blueprint = db.latestEditBlueprint(projectId);
  if (!blueprint) return { ok: false, error: "Aucun montage à modifier pour ce projet." };

  db.recordFeedback({ projectId, renderId: null, type: "conversational_command", command: typedCommand, note: null });

  if (!IMPLEMENTED_COMMANDS.includes(typedCommand)) {
    return {
      ok: false,
      error: `"${command}" n'est pas encore câblé dans ce MVP. Enregistré pour l'apprentissage du goût utilisateur (Agent 12, dossier stratégique).`,
    };
  }

  const segments = db.listSegmentsByProject(projectId);
  const segmentsById = new Map<string, Segment>(segments.map((s) => [s.id, s]));
  const styleProfile = db.getStyleProfile(blueprint.styleProfileId);
  if (!styleProfile) return { ok: false, error: "Style profile introuvable." };

  const transformed = transform(typedCommand, blueprint, segmentsById);

  const rushes = db.listRushesByProject(projectId);
  const rushPathById = Object.fromEntries(rushes.map((r) => [r.id, r.storagePath]));
  const musicFilePath = transformed.music ? (db.getMediaById(transformed.music.trackId)?.storagePath ?? null) : null;

  const renderRow = db.createRender({ projectId, editBlueprintId: transformed.id, editBlueprintVersion: transformed.version, kind: "final" });
  db.updateRenderStatus(renderRow.id, "rendering");
  const workDir = join(resolveStorageRoot(), projectId, "work", renderRow.id);
  const outputPath = join(resolveStorageRoot(), projectId, "renders", `${renderRow.id}.mp4`);
  await mkdir(dirname(outputPath), { recursive: true });

  try {
    const result = await assembleFromBlueprint(transformed, outputPath, {
      width: 1080,
      height: 1920,
      fps: 30,
      workDir,
      captionStyle: styleProfile.captionStyle,
      rushPathById,
      musicFilePath,
      musicVolumeDb: transformed.music?.volumeDb,
    });
    db.updateRenderStatus(renderRow.id, "done", { filePath: result.outputPath });
    return { ok: true, videoUrl: `/api/projects/${projectId}/video`, warnings: result.warnings };
  } catch (err) {
    db.updateRenderStatus(renderRow.id, "failed", { error: (err as Error).message });
    return { ok: false, error: `Re-rendu échoué: ${(err as Error).message}` };
  }
}

function transform(command: ConversationalCommand, blueprint: EditBlueprint, segmentsById: Map<string, Segment>): EditBlueprint {
  switch (command) {
    case "shorter": {
      const clips = blueprint.clips.slice(0, -1);
      return { ...blueprint, clips, totalDurationSec: clips.reduce((sum, c) => sum + c.outDuration, 0) };
    }
    case "faster":
      return retime(blueprint, 0.8, segmentsById);
    case "slower":
      return retime(blueprint, 1.2, segmentsById);
    case "more_zooms": {
      let added = 0;
      const clips = blueprint.clips.map((c) => {
        if (added < 2 && c.zoomKeyframes.length === 0 && c.role !== "hook") {
          added++;
          return { ...c, zoomKeyframes: [{ atSec: 0, scale: 1.15, focusX: 0.5, focusY: 0.5 }] };
        }
        return c;
      });
      return { ...blueprint, clips };
    }
    case "less_zooms": {
      let removed = 0;
      const clips = blueprint.clips.map((c) => {
        if (removed < 2 && c.zoomKeyframes.length > 0) {
          removed++;
          return { ...c, zoomKeyframes: [] };
        }
        return c;
      });
      return { ...blueprint, clips };
    }
    default:
      return blueprint;
  }
}

function retime(blueprint: EditBlueprint, factor: number, segmentsById: Map<string, Segment>): EditBlueprint {
  let cursor = 0;
  const clips = blueprint.clips.map((clip) => {
    const segment = segmentsById.get(clip.segmentId);
    const maxAvailable = segment ? segment.end - clip.sourceStart : clip.outDuration;
    const outDuration = Math.max(0.6, Math.min(clip.outDuration * factor, maxAvailable));
    const updated = { ...clip, outDuration, sourceEnd: clip.sourceStart + outDuration, timelineStart: cursor };
    cursor += outDuration;
    return updated;
  });
  return { ...blueprint, clips, totalDurationSec: cursor };
}

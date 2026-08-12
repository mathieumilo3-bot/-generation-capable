import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
// Import profond volontaire (pas le barrel @video-editor/render) : ffmpeg.ts
// n'entraîne aucune dépendance lourde (@remotion/bundler), contrairement à
// index.ts qui ré-exporte aussi remotion.ts — voir la note dans server/jobs.ts.
import { probe } from "@video-editor/render/dist/ffmpeg.js";
import type { MediaContainer } from "@video-editor/shared-types";
import { getDb } from "@/server/db";
import { startPipelineJob } from "@/server/jobs";
import { resolveStorageRoot } from "@/server/storage";

export const runtime = "nodejs";

const EXT_TO_CONTAINER: Record<string, MediaContainer> = {
  mp4: "mp4",
  mov: "mov",
  m4v: "m4v",
  webm: "webm",
};

/**
 * Écran 1 du brief (§14) : upload des rushs + brief + référence
 * optionnelle → lance le pipeline. La réponse revient dès que les
 * fichiers sont sur disque, sans attendre la fin du montage — la
 * progression réelle est ensuite lue via /api/projects/[id]/status.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  const brief = (form.get("brief") as string | null)?.trim();
  const presetId = (form.get("preset") as string | null) ?? undefined;
  // Un <input type="file"> vide contribue quand même une entrée FormData —
  // un File fantôme avec name="" et size=0 — qui n'est jamais un vrai
  // fichier. Sans ce filtre, écrire ce File à son "nom" (une chaîne vide)
  // résout vers le dossier parent lui-même → EISDIR (constaté en test).
  const isRealFile = (f: FormDataEntryValue): f is File => f instanceof File && f.size > 0 && f.name !== "";
  const rushFiles = form.getAll("rushes").filter(isRealFile);
  const referenceFiles = form.getAll("references").filter(isRealFile);

  if (!brief) {
    return NextResponse.json({ error: "Le brief est obligatoire — décris ce que tu veux créer." }, { status: 400 });
  }
  if (rushFiles.length === 0) {
    return NextResponse.json({ error: "Ajoute au moins un rush à monter." }, { status: 400 });
  }

  const db = getDb();
  const project = db.createProject({ userId: "demo-user", title: brief.slice(0, 80) });
  const rushesDir = join(resolveStorageRoot(), project.id, "rushes");
  await mkdir(rushesDir, { recursive: true });

  for (const file of rushFiles) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
    const container = EXT_TO_CONTAINER[ext] ?? "mp4";
    const destPath = join(rushesDir, file.name);
    await writeFile(destPath, Buffer.from(await file.arrayBuffer()));
    try {
      const info = await probe(destPath);
      db.createRush({
        projectId: project.id,
        originalFilename: file.name,
        storagePath: destPath,
        container,
        codec: info.videoCodec === "h264" || info.videoCodec === "hevc" ? (info.videoCodec as "h264") : "unknown",
        durationSec: info.durationSec,
        hasAudio: info.hasAudio,
      });
    } catch (err) {
      return NextResponse.json({ error: `Fichier illisible (${file.name}) : ${(err as Error).message}` }, { status: 400 });
    }
  }

  const referencePaths: string[] = [];
  if (referenceFiles.length > 0) {
    const refDir = join(resolveStorageRoot(), project.id, "references");
    await mkdir(refDir, { recursive: true });
    for (const file of referenceFiles) {
      const destPath = join(refDir, file.name);
      await writeFile(destPath, Buffer.from(await file.arrayBuffer()));
      referencePaths.push(destPath);
    }
  }

  startPipelineJob({
    projectId: project.id,
    rawBriefText: brief,
    presetId,
    referenceVideoPaths: referencePaths.length > 0 ? referencePaths : undefined,
  });

  return NextResponse.json({ projectId: project.id });
}

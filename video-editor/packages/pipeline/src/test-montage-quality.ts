/**
 * Test de QUALITÉ DE MONTAGE (§14, §15 du brief factory).
 *
 * Prouve, sur de vrais fichiers générés par ffmpeg (aucune simulation),
 * que le moteur ne reproduit plus les défauts du mauvais rendu montré par
 * l'utilisateur :
 *   1. un plan sous-exposé (nuit) est mesuré comme tel et ÉCARTÉ du montage
 *   2. un plan bien exposé est retenu
 *   3. l'ordre reste COHÉRENT (chaque rush contigu, pas de saut jour↔nuit)
 *   4. le garde-fou anti-"vide en fin" rejette une vidéo dont l'audio
 *      s'arrête bien avant l'image
 *   5. le garde-fou d'orientation rejette un rendu paysage quand on vise
 *      du vertical
 *
 * Sortie : "OK" + code 0 si tout passe, sinon lève et code 1.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Db } from "@video-editor/db";
import { ModelRouter } from "@video-editor/model-router";
import { measureBrightness, validateFinalRender } from "@video-editor/render";
import { transcribeRush, runVideoAnalyzer, runStoryDirector, runEditor } from "@video-editor/agents";
import { BUILT_IN_STYLE_PROFILES, type BriefSpec } from "@video-editor/shared-types";

const execFileAsync = promisify(execFile);
let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION ÉCHOUÉE: ${msg}`);
  passed++;
  console.log(`  ✓ ${msg}`);
}

async function ffmpeg(args: string[]): Promise<void> {
  await execFileAsync("ffmpeg", ["-hide_banner", "-y", ...args], { maxBuffer: 1024 * 1024 * 64 });
}

/** Rush BIEN EXPOSÉ (mire claire) avec audio entrecoupé de silences. */
async function genBrightRush(path: string): Promise<void> {
  await ffmpeg([
    "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=8",
    "-f", "lavfi", "-i",
    "sine=frequency=440:duration=8,volume=enable='between(t,0,1)':volume=0,volume=enable='between(t,3,3.6)':volume=0,volume=enable='between(t,6,6.6)':volume=0",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path,
  ]);
}

/** Rush SOUS-EXPOSÉ (quasi noir, YAVG ~12) avec audio — un plan de nuit illisible. */
async function genDarkRush(path: string): Promise<void> {
  await ffmpeg([
    "-f", "lavfi", "-i", "color=c=0x0c0c0c:size=1280x720:rate=30:duration=8",
    "-f", "lavfi", "-i",
    "sine=frequency=300:duration=8,volume=enable='between(t,0,1)':volume=0,volume=enable='between(t,3,3.6)':volume=0,volume=enable='between(t,6,6.6)':volume=0",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path,
  ]);
}

async function main(): Promise<void> {
  console.log("=== Test qualité de montage ===");
  const dir = await mkdtemp(join(tmpdir(), "ve-montage-test-"));
  process.env.VIDEO_EDITOR_STORAGE_ROOT = dir;
  const db = new Db(join(dir, "test.sqlite"));
  const router = new ModelRouter();

  try {
    const brightPath = join(dir, "bright.mp4");
    const darkPath = join(dir, "dark.mp4");
    await genBrightRush(brightPath);
    await genDarkRush(darkPath);

    console.log("\n[1] Mesure de luminosité réelle (ffmpeg signalstats)");
    const bBright = await measureBrightness(brightPath);
    const bDark = await measureBrightness(darkPath);
    console.log(`  plan clair YAVG=${bBright.yavg.toFixed(1)} · plan sombre YAVG=${bDark.yavg.toFixed(1)}`);
    assert(bDark.tooDark, "le plan de nuit est détecté comme trop sombre");
    assert(!bBright.tooDark, "le plan bien exposé n'est pas marqué trop sombre");

    console.log("\n[2] Analyse → qualité visuelle par segment");
    const project = db.createProject({ userId: "test", title: "montage-quality" });
    const brightRush = db.createRush({
      projectId: project.id, originalFilename: "bright.mp4", storagePath: brightPath,
      container: "mp4", codec: "h264", durationSec: 8, hasAudio: true,
    });
    const darkRush = db.createRush({
      projectId: project.id, originalFilename: "dark.mp4", storagePath: darkPath,
      container: "mp4", codec: "h264", durationSec: 8, hasAudio: true,
    });

    const brightSegs = await runVideoAnalyzer(db, router, project.id, brightRush, await transcribeRush(db, router, project.id, brightRush));
    const darkSegs = await runVideoAnalyzer(db, router, project.id, darkRush, await transcribeRush(db, router, project.id, darkRush));
    const avgVq = (segs: { visualQuality: number }[]) => segs.reduce((s, x) => s + x.visualQuality, 0) / Math.max(segs.length, 1);
    const brightVq = avgVq(brightSegs);
    const darkVq = avgVq(darkSegs);
    console.log(`  qualité visuelle moyenne — clair=${brightVq.toFixed(2)} · sombre=${darkVq.toFixed(2)}`);
    assert(brightSegs.length > 0 && darkSegs.length > 0, "les deux rushs produisent des segments");
    assert(brightVq > darkVq + 0.3, "le plan clair a une bien meilleure qualité visuelle que le sombre");
    assert(darkVq < 0.3, "les segments sombres sont sous le seuil d'exploitabilité");

    console.log("\n[3] Sélection : les plans sombres sont ÉCARTÉS du montage");
    const allSegs = [...brightSegs, ...darkSegs];
    db.insertSegments([]); // no-op de sûreté (segments déjà en mémoire)
    const brief: BriefSpec = {
      objective: "Montrer une belle balade", audience: "grand public", platform: "tiktok",
      targetDurationSec: 20, tone: "positif", style: "dynamique", dynamism: 0.6, constraints: [],
    };
    const style = BUILT_IN_STYLE_PROFILES.find((p) => p.id === "preset_dynamic_social")!;
    const story = await runStoryDirector(db, router, project.id, allSegs, brief, style, 1);
    const usedIds = new Set(story.beats.flatMap((b) => b.segmentIds));
    const darkIds = new Set(darkSegs.map((s) => s.id));
    const usedDark = [...usedIds].filter((id) => darkIds.has(id)).length;
    console.log(`  segments retenus : ${usedIds.size} dont ${usedDark} sombres`);
    assert(usedDark === 0, "aucun plan sombre n'est retenu quand des plans clairs existent");

    console.log("\n[4] Ordre cohérent : chaque rush reste contigu (pas d'entrelacement)");
    // Ajoute un 2e rush clair pour tester le regroupement multi-scènes.
    const bright2Path = join(dir, "bright2.mp4");
    await genBrightRush(bright2Path);
    const bright2Rush = db.createRush({
      projectId: project.id, originalFilename: "bright2.mp4", storagePath: bright2Path,
      container: "mp4", codec: "h264", durationSec: 8, hasAudio: true,
    });
    const bright2Segs = await runVideoAnalyzer(db, router, project.id, bright2Rush, { words: [] });
    const story2 = await runStoryDirector(db, router, project.id, [...brightSegs, ...bright2Segs], brief, style, 2);
    const segById = new Map([...brightSegs, ...bright2Segs].map((s) => [s.id, s]));
    const rushSequence = story2.beats.flatMap((b) => b.segmentIds).map((id) => segById.get(id)!.rushId);
    // Compter les transitions entre rushs différents : montage cohérent = peu de bascules.
    let switches = 0;
    for (let i = 1; i < rushSequence.length; i++) if (rushSequence[i] !== rushSequence[i - 1]) switches++;
    console.log(`  séquence de rushs : ${rushSequence.length} plans, ${switches} bascule(s) de scène`);
    assert(switches <= 1, "les scènes ne s'entrelacent pas (≤1 bascule de rush)");

    console.log("\n[5] Garde-fou anti-vide : vidéo plus longue que l'audio → rejetée");
    const deadAir = join(dir, "deadair.mp4");
    // Vidéo 12s, audio 4s → 8s de vide (le défaut constaté).
    await ffmpeg([
      "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=12",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", deadAir,
    ]);
    const vDead = await validateFinalRender(deadAir, { expectedWidth: 1080, expectedHeight: 1920 });
    console.log(`  → ${vDead.issues.join(" | ")}`);
    assert(!vDead.isValid && vDead.issues.some((i) => i.toLowerCase().includes("vide")), "le vide en fin est détecté et bloqué");

    console.log("\n[6] Garde-fou orientation : paysage alors qu'on vise vertical → rejeté");
    const landscape = join(dir, "landscape.mp4");
    await ffmpeg([
      "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=4",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", landscape,
    ]);
    const vLand = await validateFinalRender(landscape, { expectedWidth: 1080, expectedHeight: 1920 });
    console.log(`  → ${vLand.issues.join(" | ")}`);
    assert(!vLand.isValid && vLand.issues.some((i) => i.toLowerCase().includes("orientation")), "l'orientation paysage inattendue est détectée et bloquée");

    // Un vrai rendu vertical avec audio complet doit, lui, PASSER.
    const good = join(dir, "good.mp4");
    await ffmpeg([
      "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=5",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=5",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", good,
    ]);
    const vGood = await validateFinalRender(good, { expectedWidth: 1080, expectedHeight: 1920 });
    assert(vGood.isValid, "un rendu vertical propre avec audio complet passe la validation");

    // Vérifie aussi que l'Editor produit une timeline montable à partir de la sélection.
    const editStory = await runStoryDirector(db, router, project.id, brightSegs, brief, style, 3);
    const segMap = new Map(brightSegs.map((s) => [s.id, s]));
    const edit = runEditor(db, project.id, editStory, segMap, style, brief, 3);
    assert(edit.clips.length > 0, "l'Editor produit une timeline non vide depuis les plans retenus");

    console.log(`\n✅ OK — ${passed} assertions passées`);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`\n❌ ÉCHEC : ${(err as Error).message}`);
  process.exit(1);
});

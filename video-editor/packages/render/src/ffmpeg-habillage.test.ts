import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EffectSpec } from "@video-editor/shared-types";
import {
  buildAssSubtitles,
  buildEffectsFilterGraph,
  renderHabillageFFmpeg,
  type CaptionSpec,
} from "./ffmpeg-habillage.js";

const run = promisify(execFile);
const W = 360;
const H = 640;
const FPS = 30;
let dir = "";
let src = "";

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "habillage-test-"));
  src = join(dir, "src.mp4");
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `testsrc2=s=${W}x${H}:r=${FPS}:d=4`,
    "-f", "lavfi", "-i", "sine=f=440:d=4",
    "-shortest", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-pix_fmt", "yuv420p", "-c:a", "aac", src,
  ]);
});

/** Image en niveaux de gris 32×(ratio) à l'instant t, en octets bruts. */
async function grayFrame(file: string, t: number): Promise<Buffer> {
  const { stdout } = await run(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=32:56,format=gray", "-f", "rawvideo", "pipe:1"],
    { encoding: "buffer", maxBuffer: 1 << 20 }
  );
  return stdout as unknown as Buffer;
}

const mean = (b: Buffer) => b.reduce((s, v) => s + v, 0) / b.length;
const meanAbsDiff = (a: Buffer, b: Buffer) => a.reduce((s, v, i) => s + Math.abs(v - b[i]!), 0) / a.length;

async function probe(file: string) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,nb_frames", "-of", "json", file]);
  return JSON.parse(stdout).streams as { codec_type: string; width?: number; height?: number; nb_frames?: string }[];
}

const captions: CaptionSpec[] = [
  {
    startSec: 0.2,
    endSec: 1.6,
    text: "Voici {comment} on double ses ventes",
    words: [
      { word: "Voici", startSec: 0.2, endSec: 0.4 },
      { word: "{comment}", startSec: 0.4, endSec: 0.7 },
      { word: "on", startSec: 0.7, endSec: 0.8 },
      { word: "double", startSec: 0.8, endSec: 1.1, emphasize: true },
      { word: "ses", startSec: 1.1, endSec: 1.3 },
      { word: "ventes", startSec: 1.3, endSec: 1.6 },
    ],
  },
];

test("ASS : groupes courts, mot actif surligné, balises du texte neutralisées", () => {
  const ass = buildAssSubtitles(captions, 1080, 1920, "bold_dynamic");
  const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
  assert.equal(events.length, 6, "un événement par mot");
  assert.match(ass, /PlayResX: 1080/);
  assert.match(events[0]!, /^Dialogue: 0,0:00:00\.20,0:00:00\.40,Cap,/);
  assert.ok(events.every((e) => !e.includes("{comment}")), "accolades du texte retirées");
  assert.ok(events.slice(0, 3).every((e) => e.includes("COMMENT")), "majuscules en bold_dynamic");
  // Le 1er groupe contient au plus 3 mots (bold_dynamic).
  assert.equal(events[0]!.split(",").slice(9).join(",").replace(/\{[^}]*\}/g, "").trim(), "VOICI COMMENT ON");
  assert.match(events[3]!, /\\fscx122/, "mot mis en emphase = pop plus fort");
  const clean = buildAssSubtitles(captions, 1080, 1920, "minimal_clean");
  assert.equal(clean.split("\n").filter((l) => l.startsWith("Dialogue:")).length, 2, "minimal_clean : un événement par groupe (36 car. > 32 → 2 groupes)");
});

test("effets non rendus signalés, pas silencieusement appliqués", () => {
  const g = buildEffectsFilterGraph(
    [{ type: "speed_ramp", startSec: 0, endSec: 1, startSpeed: 1, endSpeed: 2 }, { type: "slide", startSec: 0, endSec: 1, direction: "left", distance: 0.2 }],
    W,
    H
  );
  assert.deepEqual(g.filters, []);
  assert.deepEqual(g.unsupported, ["speed_ramp", "slide"]);
});

test("rendu réel : taille, durée et audio conservés ; effets bornés à leur fenêtre", async () => {
  const effects: EffectSpec[] = [
    { type: "zoom", startSec: 1.0, endSec: 2.0, keyframes: [{ atSec: 1.0, scale: 1.25, focusX: 0.5, focusY: 0.5 }] },
    { type: "shake", startSec: 2.0, endSec: 2.4, intensity: 2, frequency: 8 },
    { type: "color_grade", startSec: 2.4, endSec: 2.8, saturation: 1.3, brightness: -0.05 },
    { type: "blur", startSec: 2.8, endSec: 3.0, radius: 6 },
    { type: "vignette", startSec: 3.0, endSec: 3.3, intensity: 0.5 },
    { type: "flash", startSec: 3.3, durationSec: 0.1, intensity: 0.9 },
    { type: "dip_to_black", startSec: 3.5, durationSec: 0.3 },
  ];
  // Dossier au nom piégeux : vérifie l'échappement du chemin .ass dans le graphe.
  const work = join(dir, "work: a,b [c]");
  await mkdir(work, { recursive: true });
  const out = join(dir, "out.mp4");
  await renderHabillageFFmpeg({
    inputPath: src, outputPath: out, width: W, height: H, fps: FPS, durationSec: 4,
    effects, captions, captionStyle: "bold_dynamic", workDir: work, preset: "ultrafast", crf: 12,
  });

  const streams = await probe(out);
  const v = streams.find((s) => s.codec_type === "video")!;
  assert.equal(v.width, W);
  assert.equal(v.height, H);
  assert.equal(Number(v.nb_frames), 4 * FPS);
  assert.ok(streams.some((s) => s.codec_type === "audio"), "audio conservé");

  // Hors de toute fenêtre et sans sous-titre (t = 1.9 → zoom ; t = 0.1 → rien) : image intacte.
  const untouched = meanAbsDiff(await grayFrame(src, 0.1), await grayFrame(out, 0.1));
  assert.ok(untouched < 3, `t=0.1 doit être identique à la source (écart ${untouched.toFixed(2)})`);
  const zoomed = meanAbsDiff(await grayFrame(src, 1.5), await grayFrame(out, 1.5));
  assert.ok(zoomed > 5, `t=1.5 doit être zoomé (écart ${zoomed.toFixed(2)})`);

  // Le flash éclaircit, le fondu assombrit, et seulement dans leur fenêtre.
  const flashOut = mean(await grayFrame(out, 3.31));
  const flashSrc = mean(await grayFrame(src, 3.31));
  assert.ok(flashOut > flashSrc + 30, `flash : ${flashOut.toFixed(0)} vs ${flashSrc.toFixed(0)}`);
  assert.ok(mean(await grayFrame(out, 3.65)) < 20, "milieu du fondu au noir quasi noir");
  const after = meanAbsDiff(await grayFrame(src, 3.9), await grayFrame(out, 3.9));
  assert.ok(after < 3, `après le fondu, image intacte (écart ${after.toFixed(2)})`);
});

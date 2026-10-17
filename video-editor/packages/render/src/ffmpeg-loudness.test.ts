import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { measureLoudness, normalizeLoudness, probe } from "./ffmpeg.js";

const run = promisify(execFile);

async function clip(dir: string, name: string, audio: string): Promise<string> {
  const out = join(dir, name);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=s=320x568:r=30:d=6",
    "-f", "lavfi", "-i", audio,
    "-shortest", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", out,
  ]);
  return out;
}

test("normalizeLoudness : voix trop faible ramenée à -14 LUFS, vidéo intacte", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loud-"));
  // Signal modulé (proche d'une voix) à environ -32 LUFS.
  const quiet = await clip(dir, "quiet.mp4", "sine=f=220:d=6,volume='0.04*(0.6+0.4*sin(2*PI*3*t))':eval=frame");
  const before = await measureLoudness(quiet);
  assert.ok(before.inputI < -25, `entrée trop faible (${before.inputI})`);

  const out = join(dir, "norm.mp4");
  const measured = await normalizeLoudness(quiet, out);
  assert.ok(measured);
  const after = await measureLoudness(out);
  assert.ok(Math.abs(after.inputI - -14) <= 1, `sortie à ${after.inputI} LUFS`);
  assert.ok(after.inputTp <= -1, `crête ${after.inputTp} dBTP`);

  const [a, b] = [await probe(quiet), await probe(out)];
  assert.equal(b.videoCodec, a.videoCodec);
  assert.ok(Math.abs(b.videoDurationSec - a.videoDurationSec) < 0.05, "vidéo copiée, même durée");
});

test("normalizeLoudness : fichier silencieux copié tel quel", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loud-"));
  const silent = await clip(dir, "silent.mp4", "anullsrc=r=48000:cl=mono");
  const out = join(dir, "out.mp4");
  assert.equal(await normalizeLoudness(silent, out), null);
  assert.ok((await probe(out)).hasAudio);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalSttProvider, isLocalSttModelDir, splitOnQuietPoints, tokensToWords } from "./local-stt.js";

const run = promisify(execFile);
const MODEL_DIR = process.env.VIDEO_EDITOR_STT_MODEL_DIR;

test("tokensToWords : sous-mots regroupés, ponctuation collée sans allonger le mot", () => {
  const words = tokensToWords(
    {
      text: "Ne vous demandez pas.",
      tokens: [" Ne", " vous", " dem", "ande", "z", " pas", "."],
      timestamps: [0, 0.16, 0.32, 0.48, 0.64, 0.72, 1.5],
      durations: [0.16, 0.16, 0.16, 0.16, 0.08, 0.08, 0.08],
    },
    10
  );
  assert.deepEqual(
    words.map((w) => w.word),
    ["Ne", "vous", "demandez", "pas."]
  );
  assert.equal(words[2]!.start, 10.32);
  assert.ok(Math.abs(words[2]!.end - 10.72) < 1e-9);
  assert.ok(Math.abs(words[3]!.end - 10.8) < 1e-9, "le point n'étend pas la fin du mot");
});

test("splitOnQuietPoints : coupe dans le silence, couvre tout l'audio", () => {
  const sr = 1000;
  const s = new Float32Array(60 * sr).map((_, i) => Math.sin(i));
  s.fill(0, 22 * sr, 22 * sr + 300); // respiration à 22 s
  const chunks = splitOnQuietPoints(s, sr, 25, 6);
  assert.equal(chunks[0]![0], 0);
  assert.equal(chunks.at(-1)![1], s.length);
  for (let i = 1; i < chunks.length; i++) assert.equal(chunks[i]![0], chunks[i - 1]![1]);
  assert.ok(chunks[0]![1] >= 22 * sr && chunks[0]![1] <= 22 * sr + 300, `coupe à ${chunks[0]![1]}`);
  assert.ok(chunks.every(([a, b]) => b - a <= 25 * sr));
});

test("Parakeet local : vraie voix française, mots horodatés, découpage > 25 s", { skip: !isLocalSttModelDir(MODEL_DIR) && "VIDEO_EDITOR_STT_MODEL_DIR non défini" }, async () => {
  const fr = join(MODEL_DIR!, "test_wavs", "fr.wav");
  const stt = new LocalSttProvider(MODEL_DIR!);
  const one = await stt.transcribe(fr);
  assert.match(one.data.text, /Ne vous demandez pas ce que votre pays peut faire pour vous/);
  assert.equal(one.costMicroUsd, 0);
  assert.ok(one.data.words.length >= 18);
  for (let i = 1; i < one.data.words.length; i++) assert.ok(one.data.words[i]!.start >= one.data.words[i - 1]!.start);

  // 6 répétitions séparées par 1 s de silence (~36 s) : force le découpage.
  const dir = await mkdtemp(join(tmpdir(), "stt-"));
  const long = join(dir, "long.wav");
  const inputs = Array.from({ length: 6 }, () => ["-i", fr]).flat();
  const chain = Array.from({ length: 6 }, (_, i) => `[${i}:a]aresample=16000,apad=pad_dur=1[a${i}]`).join(";");
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", `${chain};${Array.from({ length: 6 }, (_, i) => `[a${i}]`).join("")}concat=n=6:v=0:a=1[o]`, "-map", "[o]", long]);
  const many = await stt.transcribe(long);
  assert.ok(many.data.durationSec > 30);
  assert.equal(many.data.text.match(/pays/g)?.length, 6, many.data.text);
  const last = many.data.words.at(-1)!;
  assert.ok(last.end > 30 && last.end <= many.data.durationSec + 0.1, `dernier mot à ${last.end}s`);
});

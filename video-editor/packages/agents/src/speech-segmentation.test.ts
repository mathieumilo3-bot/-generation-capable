import { test } from "node:test";
import assert from "node:assert/strict";
import { findRetakes, speechPhrases, type TimedWord } from "./speech-segmentation.js";
import { planSpeechPunchIns } from "./rhythm-engine.js";
import { BUILT_IN_STYLE_PROFILES } from "@video-editor/shared-types";

/** Mots réguliers de 0,25 s séparés de 0,05 s à partir de t0. */
function say(text: string, t0: number): TimedWord[] {
  return text.split(" ").map((word, i) => ({ word, start: t0 + i * 0.3, end: t0 + i * 0.3 + 0.25 }));
}

test("speechPhrases : coupe sur les blancs et les fins de phrase, jamais dans un mot", () => {
  const words = [...say("Bonjour à tous.", 1.0), ...say("Aujourd'hui on parle prix", 2.0), ...say("et marges", 4.5)];
  const p = speechPhrases(words, 10);
  assert.deepEqual(p.map((x) => x.text), ["Bonjour à tous.", "Aujourd'hui on parle prix", "et marges"]);
  // Marges autour des mots, sans chevauchement entre phrases.
  assert.ok(Math.abs(p[0]!.start - 0.9) < 1e-9);
  for (let i = 1; i < p.length; i++) assert.ok(p[i]!.start >= p[i - 1]!.end);
  // Chaque mot est entièrement dans sa phrase.
  for (const ph of p) for (const w of ph.words) assert.ok(w.start >= ph.start && w.end <= ph.end);
});

test("speechPhrases : une tirade sans pause est découpée à ≤ 9 s, à une frontière de mot", () => {
  const long = say(Array.from({ length: 50 }, (_, i) => `mot${i}`).join(" "), 0);
  const p = speechPhrases(long, 20);
  assert.ok(p.length >= 2);
  assert.ok(p.every((x) => x.words[x.words.length - 1]!.end - x.words[0]!.start <= 9));
  assert.equal(p.reduce((n, x) => n + x.words.length, 0), 50, "aucun mot perdu");
});

test("findRetakes : la prise interrompue est retirée, la bonne gardée", () => {
  const phrases = speechPhrases(
    [
      ...say("Aujourd'hui je vais vous montrer euh", 0),
      ...say("Aujourd'hui je vais vous montrer comment doubler vos ventes.", 3),
      ...say("Et ça marche vraiment.", 8),
    ],
    12
  );
  assert.equal(phrases.length, 3);
  assert.deepEqual([...findRetakes(phrases)], [0]);
});

test("findRetakes : deux phrases qui commencent pareil mais disent autre chose ne sont pas des prises ratées", () => {
  const phrases = speechPhrases([...say("Et en plus c'est rapide.", 0), ...say("Et en plus c'est gratuit pour toujours et partout dans le monde.", 3)], 10);
  assert.equal(findRetakes(phrases).size, 0, "phrase complète (point final) : effet de style, pas une reprise");
  const different = speechPhrases([...say("On commence.", 0), ...say("On termine maintenant.", 3)], 10);
  assert.equal(findRetakes(different).size, 0);
});

test("planSpeechPunchIns : alternance large/serré en une image, rien dans la dernière seconde", () => {
  const style = BUILT_IN_STYLE_PROFILES[1]!;
  const kfs = planSpeechPunchIns({ clipDurationSec: 8, styleProfile: style, startScale: 1 });
  assert.ok(kfs.length >= 3);
  assert.equal(kfs[0]!.scale, 1);
  for (let i = 1; i + 1 < kfs.length; i += 2) {
    assert.ok(kfs[i + 1]!.atSec - kfs[i]!.atSec < 0.05, "changement en une image");
    assert.notEqual(kfs[i]!.scale, kfs[i + 1]!.scale);
  }
  assert.ok(kfs[kfs.length - 1]!.atSec < 7);
  assert.deepEqual(planSpeechPunchIns({ clipDurationSec: 1.5, styleProfile: style, startScale: 1 }), []);
});

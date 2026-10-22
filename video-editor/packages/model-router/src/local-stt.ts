import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { promisify } from "node:util";
import { ProviderError, type ProviderCallResult } from "./types.js";
import type { SttProvider, TranscriptResult, WordTiming } from "./stt.js";

const run = promisify(execFile);
const SAMPLE_RATE = 16000;

/** Fichiers attendus dans le dossier du modèle (archive sherpa-onnx Parakeet TDT v3 int8). */
export const LOCAL_STT_MODEL_FILES = ["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"] as const;

export function isLocalSttModelDir(dir: string | undefined): dir is string {
  return !!dir && LOCAL_STT_MODEL_FILES.every((f) => existsSync(join(dir, f)));
}

interface SherpaResult {
  text: string;
  tokens: string[];
  timestamps: number[];
  durations?: number[];
}

interface SherpaStream {
  acceptWaveform(w: { samples: Float32Array; sampleRate: number }): void;
}

interface SherpaRecognizer {
  createStream(): SherpaStream;
  /** Non bloquant : le décodage tourne hors de la boucle d'événements. */
  decodeAsync(s: SherpaStream): Promise<SherpaResult>;
}

interface SherpaModule {
  OfflineRecognizer: { createAsync(config: unknown): Promise<SherpaRecognizer> };
}

/**
 * Égalisation dynamique du volume avant reconnaissance : une phrase dite
 * 20-30 dB plus bas que les autres (orateur qui s'éloigne du micro) est
 * sinon ignorée par le modèle au milieu d'un passage plus fort.
 * N'affecte que l'entrée du STT, jamais le son de la vidéo.
 */
const PCM_FILTER = "dynaudnorm=f=250:g=15:m=30";

/** Décode n'importe quel fichier audio/vidéo en PCM float 16 kHz mono via ffmpeg. */
export async function decodePcm16k(path: string): Promise<Float32Array> {
  const { stdout } = await run(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", String(SAMPLE_RATE), "-af", PCM_FILTER, "-f", "f32le", "pipe:1"],
    { encoding: "buffer", maxBuffer: 1024 * 1024 * 1024 }
  );
  const buf = stdout as unknown as Buffer;
  // Copie alignée : le Buffer de Node n'est pas forcément aligné sur 4 octets.
  const out = new Float32Array(buf.length / 4);
  new Uint8Array(out.buffer).set(buf.subarray(0, out.length * 4));
  return out;
}

/**
 * Découpe l'audio en morceaux de ~maxSec, en coupant dans le passage le
 * plus silencieux des dernières secondes avant chaque limite : un mot n'est
 * jamais coupé en deux tant qu'il existe une respiration dans la fenêtre.
 */
export function splitOnQuietPoints(samples: Float32Array, sampleRate: number, maxSec = 25, searchSec = 6): [number, number][] {
  const total = samples.length;
  const maxLen = Math.floor(maxSec * sampleRate);
  if (total <= maxLen) return [[0, total]];
  const frame = Math.floor(sampleRate * 0.02);
  const chunks: [number, number][] = [];
  let start = 0;
  while (total - start > maxLen) {
    const hi = start + maxLen;
    const lo = Math.max(start + frame, hi - Math.floor(searchSec * sampleRate));
    let best = hi;
    let bestEnergy = Infinity;
    for (let f = lo; f + frame <= hi; f += frame) {
      let e = 0;
      for (let i = f; i < f + frame; i++) e += samples[i]! * samples[i]!;
      if (e < bestEnergy) {
        bestEnergy = e;
        best = f + Math.floor(frame / 2);
      }
    }
    chunks.push([start, best]);
    start = best;
  }
  chunks.push([start, total]);
  return chunks;
}

const PUNCT_ONLY = /^[\s.,!?;:…»«"'()\-–—]+$/;

/**
 * Regroupe les tokens SentencePiece (un espace en tête = début de mot) en
 * mots horodatés. La ponctuation reste collée au mot qui précède mais ne
 * compte pas dans sa durée.
 */
export function tokensToWords(r: SherpaResult, offsetSec: number): WordTiming[] {
  const words: WordTiming[] = [];
  let cur: { text: string; start: number; end: number } | null = null;
  r.tokens.forEach((tok, i) => {
    const ts = r.timestamps[i] ?? 0;
    const dur = r.durations?.[i] ?? 0.08;
    const startsWord = tok.startsWith(" ") || cur === null;
    const isPunct = PUNCT_ONLY.test(tok);
    if (startsWord && !(isPunct && cur)) {
      if (cur) words.push({ word: cur.text, start: cur.start + offsetSec, end: cur.end + offsetSec });
      cur = { text: tok.trim(), start: ts, end: ts + dur };
    } else if (cur) {
      cur.text += tok.trim();
      if (!isPunct) cur.end = ts + dur;
    }
  });
  if (cur) {
    const c = cur as { text: string; start: number; end: number };
    words.push({ word: c.text, start: c.start + offsetSec, end: c.end + offsetSec });
  }
  return words.filter((w) => w.word && !PUNCT_ONLY.test(w.word));
}

/**
 * STT local et gratuit : NVIDIA Parakeet TDT 0.6B v3 (25 langues
 * européennes dont le français, ponctuation et casse incluses) exécuté
 * sur CPU par sherpa-onnx. Timestamps mot-à-mot réels, aucun appel réseau,
 * coût marginal nul — le seul coût est le temps CPU (~0,1× temps réel sur
 * 4 vCPU).
 */
export class LocalSttProvider implements SttProvider {
  readonly isReal = true;
  private recognizer: Promise<SherpaRecognizer> | null = null;

  constructor(
    private readonly modelDir: string,
    private readonly numThreads = 4
  ) {}

  private load(): Promise<SherpaRecognizer> {
    if (!this.recognizer) {
      let sherpa: SherpaModule;
      try {
        sherpa = createRequire(import.meta.url)("sherpa-onnx-node") as SherpaModule;
      } catch (err) {
        return Promise.reject(new ProviderError("internal_stt", "Module sherpa-onnx-node introuvable", err));
      }
      const m = (f: string) => join(this.modelDir, f);
      this.recognizer = sherpa.OfflineRecognizer.createAsync({
        featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
        modelConfig: {
          transducer: { encoder: m("encoder.int8.onnx"), decoder: m("decoder.int8.onnx"), joiner: m("joiner.int8.onnx") },
          tokens: m("tokens.txt"),
          numThreads: this.numThreads,
          provider: "cpu",
          debug: 0,
          modelType: "nemo_transducer",
        },
        decodingMethod: "greedy_search",
      });
      this.recognizer.catch(() => (this.recognizer = null));
    }
    return this.recognizer;
  }

  async transcribe(audioFilePath: string): Promise<ProviderCallResult<TranscriptResult>> {
    const start = Date.now();
    let samples: Float32Array;
    try {
      samples = await decodePcm16k(audioFilePath);
    } catch (err) {
      throw new ProviderError("internal_stt", `Décodage audio impossible (${audioFilePath})`, err);
    }
    const rec = await this.load();
    const words: WordTiming[] = [];
    const texts: string[] = [];
    for (const [a, b] of splitOnQuietPoints(samples, SAMPLE_RATE)) {
      const stream = rec.createStream();
      stream.acceptWaveform({ samples: samples.subarray(a, b), sampleRate: SAMPLE_RATE });
      const r = await rec.decodeAsync(stream);
      if (r.text.trim()) texts.push(r.text.trim());
      words.push(...tokensToWords(r, a / SAMPLE_RATE));
    }
    const durationSec = samples.length / SAMPLE_RATE;
    return {
      data: { text: texts.join(" "), words, durationSec },
      provider: "internal_stt",
      model: "parakeet-tdt-0.6b-v3-int8",
      inputUnits: durationSec,
      inputUnitType: "seconds_audio",
      outputUnits: words.length,
      outputUnitType: "words",
      durationMs: Date.now() - start,
      costMicroUsd: 0,
      isStub: false,
    };
  }
}

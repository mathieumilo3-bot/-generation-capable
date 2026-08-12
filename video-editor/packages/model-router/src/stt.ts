import { readFile } from "node:fs/promises";
import { sttCostMicroUsd } from "./pricing.js";
import { ProviderError, type ProviderCallResult } from "./types.js";

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptResult {
  text: string;
  words: WordTiming[];
  durationSec: number;
}

export interface SttProvider {
  readonly isReal: boolean;
  transcribe(audioFilePath: string): Promise<ProviderCallResult<TranscriptResult>>;
}

/** Fournisseur réel — Deepgram Nova-3, timestamps mot-à-mot natifs. */
export class DeepgramSttProvider implements SttProvider {
  readonly isReal = true;
  constructor(private readonly apiKey: string) {}

  async transcribe(audioFilePath: string): Promise<ProviderCallResult<TranscriptResult>> {
    const start = Date.now();
    const buffer = await readFile(audioFilePath);
    let res: Response;
    try {
      res = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&words=true",
        {
          method: "POST",
          headers: { Authorization: `Token ${this.apiKey}`, "content-type": "audio/mpeg" },
          body: buffer,
        }
      );
    } catch (err) {
      throw new ProviderError("deepgram", "Échec réseau", err);
    }
    if (!res.ok) throw new ProviderError("deepgram", `HTTP ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      results: {
        channels: { alternatives: { transcript: string; words: { word: string; start: number; end: number }[] }[] }[];
      };
      metadata: { duration: number };
    };
    const alt = json.results.channels[0]?.alternatives[0];
    const durationSec = json.metadata.duration;
    return {
      data: {
        text: alt?.transcript ?? "",
        words: alt?.words ?? [],
        durationSec,
      },
      provider: "deepgram",
      model: "nova-3",
      inputUnits: durationSec,
      inputUnitType: "seconds_audio",
      outputUnits: alt?.words.length ?? 0,
      outputUnitType: "words",
      durationMs: Date.now() - start,
      costMicroUsd: sttCostMicroUsd(durationSec),
      isStub: false,
    };
  }
}

/**
 * Aucune clé STT configurée : transcript vide et explicitement marqué
 * comme non disponible, jamais un texte plausible inventé. Le Video
 * Analyzer et le Caption Director basculent alors sur un mode dégradé
 * documenté (analyse audio par ffmpeg uniquement, pas de sous-titres).
 */
export class StubSttProvider implements SttProvider {
  readonly isReal = false;

  async transcribe(_audioFilePath: string): Promise<ProviderCallResult<TranscriptResult>> {
    return {
      data: { text: "", words: [], durationSec: 0 },
      provider: "stub",
      model: "stub-stt",
      inputUnits: 0,
      inputUnitType: "seconds_audio",
      outputUnits: 0,
      outputUnitType: "words",
      durationMs: 0,
      costMicroUsd: 0,
      isStub: true,
    };
  }
}

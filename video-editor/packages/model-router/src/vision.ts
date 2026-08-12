import { visionCostMicroUsd } from "./pricing.js";
import { ProviderError, type ProviderCallResult } from "./types.js";

export interface VisionAnalyzeParams {
  /** Frames JPEG échantillonnées du segment, en base64 — jamais le flux vidéo complet (§06 : les tokens vidéo coûtent cher en volume brut). */
  framesBase64: string[];
  transcript: string;
  prompt: string;
}

export interface VisionProvider {
  readonly isReal: boolean;
  analyzeSegment(params: VisionAnalyzeParams): Promise<ProviderCallResult<string>>;
}

/**
 * Fournisseur réel — Gemini Flash, seul modèle avec ingestion vidéo/image
 * native en API standard aujourd'hui (§06 du dossier stratégique). On
 * envoie des frames échantillonnées, pas le flux brut, pour maîtriser le
 * coût. Non exercé dans cette session (pas de clé disponible) : à
 * vérifier contre la documentation Gemini au premier vrai test.
 */
export class GeminiVisionProvider implements VisionProvider {
  readonly isReal = true;
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gemini-flash-latest"
  ) {}

  async analyzeSegment(params: VisionAnalyzeParams): Promise<ProviderCallResult<string>> {
    const start = Date.now();
    const parts: unknown[] = params.framesBase64.map((data) => ({
      inlineData: { mimeType: "image/jpeg", data },
    }));
    parts.push({ text: `${params.prompt}\n\nTranscript du segment:\n${params.transcript}` });
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }] }),
        }
      );
    } catch (err) {
      throw new ProviderError("google_gemini", "Échec réseau", err);
    }
    if (!res.ok) throw new ProviderError("google_gemini", `HTTP ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
      usageMetadata: { promptTokenCount: number; candidatesTokenCount: number };
    };
    const text = json.candidates[0]?.content.parts[0]?.text ?? "";
    const inputTokens = json.usageMetadata.promptTokenCount;
    const outputTokens = json.usageMetadata.candidatesTokenCount;
    return {
      data: text,
      provider: "google_gemini",
      model: this.model,
      inputUnits: inputTokens,
      inputUnitType: "tokens",
      outputUnits: outputTokens,
      outputUnitType: "tokens",
      durationMs: Date.now() - start,
      costMicroUsd: visionCostMicroUsd(inputTokens, outputTokens),
      isStub: false,
    };
  }
}

export class StubVisionProvider implements VisionProvider {
  readonly isReal = false;

  async analyzeSegment(_params: VisionAnalyzeParams): Promise<ProviderCallResult<string>> {
    return {
      data: "[[STUB:NO_VISION_API_KEY]]",
      provider: "stub",
      model: "stub-vision",
      inputUnits: 0,
      inputUnitType: "tokens",
      outputUnits: 0,
      outputUnitType: "tokens",
      durationMs: 0,
      costMicroUsd: 0,
      isStub: true,
    };
  }
}

import { AnthropicLLMProvider, StubLLMProvider, type LLMProvider } from "./llm.js";
import { DeepgramSttProvider, StubSttProvider, type SttProvider } from "./stt.js";
import { LocalSttProvider, isLocalSttModelDir } from "./local-stt.js";
import { GeminiVisionProvider, StubVisionProvider, type VisionProvider } from "./vision.js";
import { StubTtvProvider, type TtvProvider } from "./ttv.js";

export interface ModelRouterCapabilities {
  llm: boolean;
  vision: boolean;
  stt: boolean;
  ttv: boolean;
}

/**
 * Point d'entrée unique vers tous les fournisseurs IA. Choisit
 * l'implémentation réelle si la clé correspondante est présente dans
 * l'environnement, sinon un stub honnête (§06 : couche de Model Router
 * obligatoire, aucun agent ne doit importer un SDK fournisseur
 * directement). `capabilities` permet aux agents de savoir, avant
 * d'appeler, s'ils doivent utiliser leur repli déterministe.
 */
export class ModelRouter {
  readonly llm: LLMProvider;
  readonly vision: VisionProvider;
  readonly stt: SttProvider;
  readonly ttv: TtvProvider;
  readonly capabilities: ModelRouterCapabilities;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const anthropicKey = env.ANTHROPIC_API_KEY;
    const geminiKey = env.GOOGLE_API_KEY ?? env.GEMINI_API_KEY;
    const deepgramKey = env.DEEPGRAM_API_KEY;

    this.llm = anthropicKey
      ? new AnthropicLLMProvider({ apiKey: anthropicKey, baseUrl: env.ANTHROPIC_BASE_URL })
      : new StubLLMProvider();
    this.vision = geminiKey ? new GeminiVisionProvider(geminiKey) : new StubVisionProvider();
    this.stt = selectStt(env, deepgramKey);
    this.ttv = new StubTtvProvider(); // toujours stub au MVP, cf. §5 Agent 05

    this.capabilities = {
      llm: this.llm.isReal,
      vision: this.vision.isReal,
      stt: this.stt.isReal,
      ttv: this.ttv.isReal,
    };
  }
}

/**
 * STT : le modèle local (gratuit) passe en premier dès qu'il est installé ;
 * Deepgram (payant) seulement s'il n'y a pas de modèle local ou si
 * VIDEO_EDITOR_STT=deepgram le demande explicitement.
 */
function selectStt(env: NodeJS.ProcessEnv, deepgramKey: string | undefined): SttProvider {
  const choice = env.VIDEO_EDITOR_STT ?? "auto";
  const modelDir = env.VIDEO_EDITOR_STT_MODEL_DIR;
  const threads = Number(env.VIDEO_EDITOR_STT_THREADS) || 4;
  if (choice === "off") return new StubSttProvider();
  if (choice === "deepgram" && deepgramKey) return new DeepgramSttProvider(deepgramKey);
  if (choice !== "deepgram" && isLocalSttModelDir(modelDir)) return new LocalSttProvider(modelDir, threads);
  if (deepgramKey) return new DeepgramSttProvider(deepgramKey);
  return new StubSttProvider();
}

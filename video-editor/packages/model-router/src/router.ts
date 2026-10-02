import { AnthropicLLMProvider, StubLLMProvider, type LLMProvider } from "./llm.js";
import { DeepgramSttProvider, StubSttProvider, type SttProvider } from "./stt.js";
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
    this.stt = deepgramKey ? new DeepgramSttProvider(deepgramKey) : new StubSttProvider();
    this.ttv = new StubTtvProvider(); // toujours stub au MVP, cf. §5 Agent 05

    this.capabilities = {
      llm: this.llm.isReal,
      vision: this.vision.isReal,
      stt: this.stt.isReal,
      ttv: this.ttv.isReal,
    };
  }
}

/**
 * Contrat stable entre l'orchestrateur et le moteur vidéo (passerelle `/api/engine/v1`
 * dans video-editor/). L'application mobile ne connaît JAMAIS ce contrat.
 */
export type EngineStage = "preparing" | "analyzing" | "editing" | "rendering" | "quality_check";
export type EngineState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface EngineInput {
  assetId: string;
  role: "rush" | "reference" | "image" | "logo" | "audio_note";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** URL signée de téléchargement (courte durée). */
  url: string;
  durationSec?: number | null;
}

export interface EngineJobRequest {
  externalJobId: string;          // = video_jobs.id → idempotence côté moteur
  correlationId: string;
  kind: "create" | "revision";
  /** Numéro de tentative (1, 2…) : un nouveau numéro autorise le moteur à REPARTIR après un échec définitif (relance admin). */
  attempt?: number;
  inputs: EngineInput[];
  /** Instructions de l'utilisateur (donnée, jamais instruction système). */
  brief: string | null;
  presetId: string;
  useReferences: boolean;
  aspectRatio: string;
  targetDurationMaxSec: number;
  revision?: { parentExternalJobId: string; commands: string[] };
}

export interface EngineCostsRaw {
  /** Lignes du cost_ledger du moteur (µUSD). */
  entries: { provider: string; callType: string; costMicroUsd: number; isStub: boolean }[];
  renderComputeSec?: number;
}

export interface EngineJobStatus {
  engineJobId: string;
  state: EngineState;
  stage: EngineStage | null;
  progress: number;                 // 0..100 réel
  etaSec: number | null;
  error?: { code: string; message: string; retryable: boolean };
  result?: { durationSec: number; width: number; height: number; sizeBytes: number };
  costs?: EngineCostsRaw;
  engineVersion: string;
}

export interface EngineClient {
  capabilities(): Promise<Record<string, unknown>>;
  submit(req: EngineJobRequest): Promise<{ engineJobId: string }>;
  status(engineJobId: string): Promise<EngineJobStatus>;
  cancel(engineJobId: string): Promise<void>;
  /** Flux du MP4 final. */
  result(engineJobId: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number }>;
  thumbnail(engineJobId: string): Promise<Uint8Array>;
}

export class EngineError extends Error {
  constructor(readonly kind: "network" | "unauthorized" | "rejected" | "server", message: string, readonly status?: number) {
    super(message);
    this.name = "EngineError";
  }
  get retryable() { return this.kind === "network" || this.kind === "server"; }
}

/** Client HTTP de la passerelle. Le jeton est un secret serveur-à-serveur. */
export function createHttpEngineClient(o: { baseUrl: string; token: string; fetchImpl?: typeof fetch; timeoutMs?: number }): EngineClient {
  const f = o.fetchImpl ?? fetch;
  const base = o.baseUrl.replace(/\/$/, "") + "/api/engine/v1";
  const req = async (path: string, init: RequestInit = {}): Promise<Response> => {
    let res: Response;
    try {
      res = await f(base + path, {
        ...init, headers: { authorization: `Bearer ${o.token}`, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(o.timeoutMs ?? 60_000),
      });
    } catch (e) { throw new EngineError("network", (e as Error).message); }
    if (res.status === 401 || res.status === 403) throw new EngineError("unauthorized", "Jeton moteur refusé", res.status);
    if (res.status >= 500) throw new EngineError("server", `Moteur indisponible (${res.status})`, res.status);
    if (!res.ok) throw new EngineError("rejected", `Requête refusée (${res.status}) ${await res.text().catch(() => "")}`.slice(0, 300), res.status);
    return res;
  };
  const json = async <T>(path: string, init?: RequestInit) => (await (await req(path, init)).json()) as T;
  return {
    capabilities: () => json("/capabilities"),
    submit: (r) => json("/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r) }),
    status: (id) => json(`/jobs/${encodeURIComponent(id)}`),
    cancel: async (id) => { await req(`/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" }); },
    result: async (id) => {
      const res = await req(`/jobs/${encodeURIComponent(id)}/result`);
      if (!res.body) throw new EngineError("server", "Réponse vide");
      return { stream: res.body, size: Number(res.headers.get("content-length") ?? 0) };
    },
    thumbnail: async (id) => new Uint8Array(await (await req(`/jobs/${encodeURIComponent(id)}/thumbnail`)).arrayBuffer()),
  };
}

// ── Coûts : cost_ledger du moteur (µUSD) → catégories métier (µ€) ───────
export interface CostCategories {
  transcription_cost_micro: number; llm_cost_micro: number; generation_cost_micro: number;
  render_compute_cost_micro: number; storage_cost_micro: number; music_cost_micro: number;
  external_api_cost_micro: number; other_cost_micro: number;
}

export function mapEngineCosts(
  costs: EngineCostsRaw | undefined,
  o: { usdToEur: number; renderComputeMicroEurPerSec?: number; storageBytes?: number; storageMicroEurPerGbMonth?: number; storageMonths?: number },
): CostCategories {
  const out: CostCategories = {
    transcription_cost_micro: 0, llm_cost_micro: 0, generation_cost_micro: 0, render_compute_cost_micro: 0,
    storage_cost_micro: 0, music_cost_micro: 0, external_api_cost_micro: 0, other_cost_micro: 0,
  };
  const eur = (usdMicro: number) => Math.round(usdMicro * o.usdToEur);
  for (const e of costs?.entries ?? []) {
    if (e.isStub || e.costMicroUsd <= 0) continue;
    const v = eur(e.costMicroUsd);
    switch (e.callType) {
      case "stt": out.transcription_cost_micro += v; break;
      case "llm": case "vision": out.llm_cost_micro += v; break;
      case "ttv": out.generation_cost_micro += v; break;
      case "music": out.music_cost_micro += v; break;
      case "render": out.render_compute_cost_micro += v; break;
      default: e.provider === "stock_library" ? (out.external_api_cost_micro += v) : (out.other_cost_micro += v);
    }
  }
  out.render_compute_cost_micro += Math.round((costs?.renderComputeSec ?? 0) * (o.renderComputeMicroEurPerSec ?? 0));
  if (o.storageBytes && o.storageMicroEurPerGbMonth) {
    out.storage_cost_micro = Math.round((o.storageBytes / 1e9) * o.storageMicroEurPerGbMonth * (o.storageMonths ?? 1));
  }
  return out;
}

/** Étape moteur → statut du job applicatif. */
export function stageToJobStatus(stage: EngineStage | null): "preparing" | "analyzing" | "editing" | "rendering" | "quality_check" {
  return stage ?? "preparing";
}
export * from "./fake-engine";

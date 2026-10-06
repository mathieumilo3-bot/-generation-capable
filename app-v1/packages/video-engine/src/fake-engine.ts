import type { EngineClient, EngineJobRequest, EngineJobStatus } from "./index";
import { EngineError } from "./index";

export interface FakeEngineOptions {
  /** Étapes jouées à chaque appel de status(), puis résultat. */
  script?: { stage: EngineJobStatus["stage"]; progress: number }[];
  failWith?: { code: string; message: string; retryable: boolean };
  /** Nombre de status() qui échouent en réseau avant de répondre. */
  flakyStatus?: number;
  videoBytes?: Uint8Array;
  costs?: EngineJobStatus["costs"];
}

/** Moteur factice déterministe pour tester l'orchestrateur sans FFmpeg. Idempotent par externalJobId comme la vraie passerelle. */
export class FakeEngine implements EngineClient {
  readonly submitted: EngineJobRequest[] = [];
  readonly cancelled: string[] = [];
  readonly purged: string[] = [];
  private jobs = new Map<string, { req: EngineJobRequest; step: number; cancelled: boolean }>();
  private byExternal = new Map<string, string>();
  private flaky: number;
  constructor(private o: FakeEngineOptions = {}) { this.flaky = o.flakyStatus ?? 0; }

  async capabilities() {
    return {
      engine_version: "fake-1", autonomous_creation: false, aspect_ratios: ["9:16"], max_duration_sec: 180, reference_mode: true,
      revisions: { enabled: true, commands: ["shorter", "faster", "slower", "more_zooms", "less_zooms"] }, voice_instructions: true,
    };
  }

  async submit(req: EngineJobRequest) {
    const existing = this.byExternal.get(req.externalJobId);
    if (existing) return { engineJobId: existing };
    const id = `eng_${this.jobs.size + 1}`;
    this.jobs.set(id, { req, step: 0, cancelled: false });
    this.byExternal.set(req.externalJobId, id);
    this.submitted.push(req);
    return { engineJobId: id };
  }

  async status(id: string): Promise<EngineJobStatus> {
    if (this.flaky > 0) { this.flaky--; throw new EngineError("network", "reset"); }
    const j = this.jobs.get(id);
    if (!j) throw new EngineError("rejected", "inconnu", 404);
    const script = this.o.script ?? [
      { stage: "analyzing", progress: 20 }, { stage: "editing", progress: 55 },
      { stage: "rendering", progress: 80 }, { stage: "quality_check", progress: 95 },
    ];
    const base = { engineJobId: id, engineVersion: "fake-1", etaSec: null as number | null };
    if (j.cancelled) return { ...base, state: "cancelled", stage: null, progress: 0 };
    if (j.step < script.length) {
      const s = script[j.step++]!;
      return { ...base, state: "running", stage: s.stage, progress: s.progress };
    }
    if (this.o.failWith) return { ...base, state: "failed", stage: null, progress: 0, error: this.o.failWith };
    return {
      ...base, state: "succeeded", stage: null, progress: 100,
      result: { durationSec: 41.2, width: 1080, height: 1920, sizeBytes: (this.o.videoBytes ?? new Uint8Array([1, 2, 3])).length },
      costs: this.o.costs ?? { entries: [{ provider: "anthropic", callType: "llm", costMicroUsd: 100000, isStub: false }], renderComputeSec: 30 },
    };
  }

  async cancel(id: string) { this.cancelled.push(id); const j = this.jobs.get(id); if (j) j.cancelled = true; }

  async result() {
    const bytes = this.o.videoBytes ?? new Uint8Array([1, 2, 3]);
    return { stream: new Blob([bytes as BlobPart]).stream() as ReadableStream<Uint8Array>, size: bytes.length };
  }
  async thumbnail() { return new Uint8Array([9, 9]); }
  async purge(id: string) { this.purged.push(id); }
}

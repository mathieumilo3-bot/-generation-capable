import { describe, expect, it } from "vitest";
import { createHttpEngineClient, EngineError, mapEngineCosts, FakeEngine } from "../src/index";

describe("mapEngineCosts", () => {
  const raw = {
    entries: [
      { provider: "deepgram", callType: "stt", costMicroUsd: 30_000, isStub: false },
      { provider: "anthropic", callType: "llm", costMicroUsd: 100_000, isStub: false },
      { provider: "google_gemini", callType: "vision", costMicroUsd: 50_000, isStub: false },
      { provider: "stock_library", callType: "other", costMicroUsd: 10_000, isStub: false },
      { provider: "stub", callType: "llm", costMicroUsd: 999_999, isStub: true },
    ],
    renderComputeSec: 60,
  };
  it("répartit par catégorie, ignore les stubs, convertit en µ€", () => {
    const c = mapEngineCosts(raw, { usdToEur: 0.9, renderComputeMicroEurPerSec: 500 });
    expect(c.transcription_cost_micro).toBe(27_000);
    expect(c.llm_cost_micro).toBe(135_000);
    expect(c.external_api_cost_micro).toBe(9_000);
    expect(c.render_compute_cost_micro).toBe(30_000);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(27_000 + 135_000 + 9_000 + 30_000);
  });
  it("sans coûts → zéros", () => {
    expect(Object.values(mapEngineCosts(undefined, { usdToEur: 1 })).every((v) => v === 0)).toBe(true);
  });
  it("coût de stockage estimé", () => {
    expect(mapEngineCosts(undefined, { usdToEur: 1, storageBytes: 2e9, storageMicroEurPerGbMonth: 20_000 }).storage_cost_micro).toBe(40_000);
  });
});

describe("client HTTP de la passerelle", () => {
  const mk = (handler: (url: string, init: RequestInit) => Response | Promise<Response>) =>
    createHttpEngineClient({ baseUrl: "http://engine", token: "tok", fetchImpl: (async (u: string, i: RequestInit) => handler(String(u), i)) as typeof fetch });
  it("envoie le jeton serveur et parse la réponse", async () => {
    let auth = "";
    const c = mk((url, init) => { auth = (init.headers as Record<string, string>).authorization!; return Response.json({ engineJobId: "e1" }); });
    expect(await c.submit({} as never)).toEqual({ engineJobId: "e1" });
    expect(auth).toBe("Bearer tok");
  });
  it("classe les erreurs (réseau/401/5xx réessayables ; 4xx non)", async () => {
    const e = async (res: () => Response | Promise<Response>) => { try { await mk(res).status("x"); } catch (err) { return err as EngineError; } };
    expect((await e(() => new Response("", { status: 401 })))!.kind).toBe("unauthorized");
    expect((await e(() => new Response("", { status: 503 })))!.retryable).toBe(true);
    expect((await e(() => new Response("bad", { status: 422 })))!.retryable).toBe(false);
    expect((await e(() => { throw new Error("ECONNRESET"); }))!.kind).toBe("network");
  });
});

describe("FakeEngine", () => {
  it("est idempotent par externalJobId", async () => {
    const f = new FakeEngine();
    const a = await f.submit({ externalJobId: "j1" } as never);
    const b = await f.submit({ externalJobId: "j1" } as never);
    expect(a).toEqual(b);
    expect(f.submitted).toHaveLength(1);
  });
});

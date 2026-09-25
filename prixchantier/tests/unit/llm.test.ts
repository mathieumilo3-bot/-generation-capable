import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { z } from "zod";
import { responseEnvelope, startMockOpenAi } from "../support/mock-openai-server";

/**
 * La vraie couche SDK (API Responses) contre un serveur HTTP local :
 * sortie structurée, journal de consommation, et classement des pannes.
 */

const PORT = 4311;
let server: Server;
let mode: "ok" | "401" | "402" | "429" | "500" | "incomplete" | "bad_schema" = "ok";
const usage: { task: string; inputTokens: number; ok: boolean; context?: unknown }[] = [];

beforeAll(async () => {
  process.env.OPENAI_API_KEY = "test";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${PORT}/v1`;
  server = await startMockOpenAi(PORT, ({ name }) => {
    if (mode === "ok") return null;
    if (mode === "incomplete") return { status: 200, body: responseEnvelope("m", '{"a":', "incomplete") };
    if (mode === "bad_schema") return { status: 200, body: responseEnvelope("m", JSON.stringify({ items: "pas un tableau" })) };
    const status = Number(mode);
    const code = mode === "402" ? "insufficient_quota" : null;
    return { status, body: { error: { message: `erreur ${name}`, type: "x", code } } };
  });
  const { setUsageRecorder } = await import("@/lib/ai/llm");
  setUsageRecorder((e) => usage.push(e));
});
afterAll(() => server.close());

const schema = z.object({ items: z.array(z.object({ i: z.number().int(), category: z.string(), supplier_required: z.boolean(), subcontractor_required: z.boolean(), confidence: z.number() })) });
const request = { name: "classement_lignes", system: "s", content: JSON.stringify([{ i: 0, designation: "Radiateur acier type 22" }]), schema, context: { organizationId: "org-1" } };

describe("couche IA (API Responses, Structured Outputs)", () => {
  it("renvoie une sortie validée par le schéma et journalise la consommation", async () => {
    const { getLlm, DEFAULT_MODEL } = await import("@/lib/ai/llm");
    delete process.env.OPENAI_MODEL;
    expect(DEFAULT_MODEL).toBe("gpt-5.6-luna");
    mode = "ok";
    const res = await getLlm().structured(request);
    expect(res.items[0]).toMatchObject({ i: 0, category: "Émetteurs" });
    expect(usage.at(-1)).toMatchObject({ task: "classement_lignes", inputTokens: 1200, ok: true, context: { organizationId: "org-1" } });
  });

  it.each([
    ["401", "auth", false],
    ["402", "credit", false],
    ["429", "rate_limit", true],
    ["500", "provider_down", true],
    ["incomplete", "truncated", false],
    ["bad_schema", "invalid_output", true],
  ] as const)("HTTP/%s → panne « %s » (réessayable : %s)", async (m, kind, retryable) => {
    const { getLlm, AiFailure } = await import("@/lib/ai/llm");
    mode = m;
    const err = await getLlm().structured(request).catch((e) => e);
    expect(err).toBeInstanceOf(AiFailure);
    expect(err.kind).toBe(kind);
    expect(err.retryable).toBe(retryable);
    expect(usage.at(-1)?.ok).toBe(false);
  });

  it("clé absente : panne définitive explicite", async () => {
    const { getLlm } = await import("@/lib/ai/llm");
    const key = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(() => getLlm()).toThrow(/OPENAI_API_KEY manquante/);
    process.env.OPENAI_API_KEY = key;
  });
});

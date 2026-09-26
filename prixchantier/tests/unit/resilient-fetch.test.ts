import { describe, expect, it } from "vitest";
import { resilientFetch } from "@/lib/supabase/resilient-fetch";

function fakeFetch(sequence: (number | "network")[]) {
  const calls: string[] = [];
  const f = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init?.method ?? "GET");
    const next = sequence.shift() ?? 200;
    if (next === "network") throw new TypeError("fetch failed");
    return new Response("{}", { status: next });
  }) as typeof fetch;
  return { f, calls };
}

describe("réessais des lectures Supabase", () => {
  it("réessaie une lecture après une coupure réseau puis un 503", async () => {
    const { f, calls } = fakeFetch(["network", 503, 200]);
    const res = await resilientFetch(f, { baseDelayMs: 1 })("http://x/rest/v1/projects");
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(3);
  });

  it("ne rejoue jamais une écriture (risque de doublon)", async () => {
    const { f, calls } = fakeFetch([503, 200]);
    const res = await resilientFetch(f, { baseDelayMs: 1 })("http://x/rest/v1/offers", { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
    expect(calls).toEqual(["POST"]);
  });

  it("ne réessaie pas une erreur définitive (4xx)", async () => {
    const { f, calls } = fakeFetch([404]);
    expect((await resilientFetch(f, { baseDelayMs: 1 })("http://x")).status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  it("abandonne après 3 tentatives", async () => {
    const { f, calls } = fakeFetch(["network", "network", "network"]);
    await expect(resilientFetch(f, { baseDelayMs: 1 })("http://x")).rejects.toThrow("fetch failed");
    expect(calls).toHaveLength(3);
  });
});

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

/**
 * Exercises POST /api/audit/analyze. Every case sends its own
 * X-Forwarded-For so the shared rate limiter cannot make one test's budget
 * depend on another's — same pattern as audit-api.spec.ts.
 *
 * Deliberately targets URLs that resolve instantly to a "blocked" or
 * "invalid" outcome (SSRF guard, unparseable address) rather than a real
 * domain: the engine still returns a complete, valid — if degraded —
 * Report for these, which is enough to test the API contract without a
 * flaky dependency on real outbound network access from the test runner.
 */
function freshIp() {
  return { "X-Forwarded-For": `203.0.113.${randomUUID()}` };
}

test.describe("POST /api/audit/analyze", () => {
  test("rejects a null body instead of crashing", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", {
      headers: { "Content-Type": "application/json", ...freshIp() },
      data: "null",
    });
    expect(res.status()).toBe(400);
  });

  test("rejects malformed JSON", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", {
      headers: { "Content-Type": "application/json", ...freshIp() },
      data: "{not json",
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an array body", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", { headers: freshIp(), data: [] });
    expect(res.status()).toBe(400);
  });

  test("requires siteUrl", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", {
      headers: freshIp(),
      data: { siteUrl: "", secteur: "Restaurants", objectif: "Plus de demandes" },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error).toBe("missing_fields");
  });

  test("rejects an oversized payload", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", {
      headers: freshIp(),
      data: { siteUrl: "https://exemple.fr", secteur: "x".repeat(20_000), objectif: "" },
    });
    expect(res.status()).toBe(413);
  });

  test("returns a complete, degraded report for a blocked SSRF target — never a 500", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", {
      headers: freshIp(),
      data: { siteUrl: "http://127.0.0.1/admin", secteur: "Restaurants", objectif: "Plus de demandes" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.report.degraded).toBe(true);
    expect(body.report.degradedReason).toBeTruthy();
    expect(body.report.header.sectorProfile).toBe("restaurant");
    expect(Array.isArray(body.report.topLeaks)).toBe(true);
    expect(Array.isArray(body.report.worksWell)).toBe(true);
    expect(body.report.engineVersion).toBeTruthy();
  });

  test("returns a report even for an unparseable site address", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", {
      headers: freshIp(),
      data: { siteUrl: "not a url at all !!!", secteur: "Coachs", objectif: "" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.report.degraded).toBe(true);
    expect(body.report.header.sectorProfile).toBe("coach");
  });

  test("falls back to the AUTRE sector for an unrecognized activity, without erroring", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", {
      headers: freshIp(),
      data: { siteUrl: "http://10.0.0.1", secteur: "Éditeur de bandes dessinées", objectif: "" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).report.header.sectorProfile).toBe("autre");
  });

  test("accepts a missing secteur/objectif gracefully", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", {
      headers: freshIp(),
      data: { siteUrl: "http://192.168.1.1" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.report.header.sectorProfile).toBe("autre");
  });

  test("does not require PII — no name or email field is accepted or needed", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", {
      headers: freshIp(),
      data: { siteUrl: "http://[::1]", secteur: "Restaurants", objectif: "" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/@/); // no email ever echoed back
  });

  test("rate limits a flood from one address", async ({ request }) => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request.post("/api/audit/analyze", {
        headers: ip,
        data: { siteUrl: "http://127.0.0.1", secteur: "Restaurants", objectif: "" },
      });
      statuses.push(res.status());
    }
    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  test("is never cached or indexed (baseline API headers)", async ({ request }) => {
    const res = await request.post("/api/audit/analyze", {
      headers: freshIp(),
      data: { siteUrl: "http://127.0.0.1", secteur: "Restaurants", objectif: "" },
    });
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
  });
});

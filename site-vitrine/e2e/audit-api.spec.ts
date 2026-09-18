import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

/**
 * Exercises the real POST /api/audit contract. Every case sends its own
 * X-Forwarded-For so the shared rate limiter cannot make one test's budget
 * depend on another's.
 */
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    siteUrl: "https://exemple.fr",
    secteur: "Restaurants",
    objectif: "Plus de demandes",
    nom: "Marie",
    entreprise: "Le Bistrot",
    email: "marie@exemple.fr",
    telephone: "0600000000",
    ...overrides,
  };
}

/**
 * A unique key per case. The limiter only uses this header as a map key, and
 * the suite runs several projects in parallel, so uniqueness matters more
 * than the value looking like a real address.
 */
function freshIp() {
  return { "X-Forwarded-For": `203.0.113.${randomUUID()}` };
}

test.describe("POST /api/audit", () => {
  test("rejects a null body instead of crashing", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: { "Content-Type": "application/json", ...freshIp() },
      data: "null",
    });
    expect(res.status()).toBe(400);
  });

  test("rejects malformed JSON", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: { "Content-Type": "application/json", ...freshIp() },
      data: "{not json",
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an array body", async ({ request }) => {
    const res = await request.post("/api/audit", { headers: freshIp(), data: [] });
    expect(res.status()).toBe(400);
  });

  test("reports missing required fields", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: freshIp(),
      data: validBody({ email: "", siteUrl: "" }),
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("missing_fields");
    expect(body.missing).toEqual(expect.arrayContaining(["email", "siteUrl"]));
  });

  test("rejects an invalid email", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: freshIp(),
      data: validBody({ email: "pas-un-email" }),
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error).toBe("invalid_email");
  });

  test("does not accept a non-string field", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: freshIp(),
      data: validBody({ siteUrl: { toString: "x" } }),
    });
    expect(res.status()).toBe(422);
  });

  test("rejects an over-long field", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: freshIp(),
      data: validBody({ nom: "x".repeat(500) }),
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error).toBe("field_too_long");
  });

  test("rejects an oversized payload", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: freshIp(),
      data: validBody({ entreprise: "x".repeat(20_000) }),
    });
    expect(res.status()).toBe(413);
  });

  test("silently drops a submission that filled the honeypot", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: freshIp(),
      data: validBody({ site_web_confirmation: "http://spam.example" }),
    });
    // Looks like success to the bot, but nothing was sent.
    expect(res.status()).toBe(200);
    expect((await res.json()).emailed).toBeUndefined();
  });

  test("rate limits a flood from one address", async ({ request }) => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await request.post("/api/audit", { headers: ip, data: validBody() });
      statuses.push(res.status());
    }

    // Asserting "not throttled" rather than 200: whether the mail actually
    // goes out depends on the environment's Resend credentials, and that is
    // not what this test is about.
    expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect(statuses[6]).toBe(429);
  });

  test("answers a rate-limited caller with Retry-After", async ({ request }) => {
    const ip = freshIp();
    for (let i = 0; i < 6; i++) {
      await request.post("/api/audit", { headers: ip, data: validBody() });
    }
    const res = await request.post("/api/audit", { headers: ip, data: validBody() });
    expect(res.status()).toBe(429);
    expect(Number(res.headers()["retry-after"])).toBeGreaterThan(0);
  });

  test("does not let one address exhaust another's budget", async ({ request }) => {
    const noisy = freshIp();
    for (let i = 0; i < 6; i++) {
      await request.post("/api/audit", { headers: noisy, data: validBody() });
    }
    const res = await request.post("/api/audit", { headers: freshIp(), data: validBody() });
    expect(res.status()).not.toBe(429);
  });
});

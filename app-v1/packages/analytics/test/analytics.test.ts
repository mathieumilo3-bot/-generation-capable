import { describe, expect, it } from "vitest";
import { createAnalytics, sanitizeProps, EVENTS, type AnalyticsSink } from "../src/index";

describe("sanitizeProps", () => {
  it("retire e-mails, jetons, noms et textes libres", () => {
    const out = sanitizeProps({
      email: "a@b.fr", note: "x", first_name: "Alice", instructions: "ma pub secrète", file_path: "u/p/x.mp4",
      value: "contact me at a@b.fr", jwt: "eyJhbGciOi.eyJzdWIi.abcdef", opaque: "A".repeat(40),
      price_cents: 484, duration_sec: 45, mode: "edit_rushes", ok: true,
    });
    expect(out).toEqual({ price_cents: 484, duration_sec: 45, mode: "edit_rushes", ok: true });
  });
  it("tronque et ignore les types exotiques", () => {
    expect(sanitizeProps({ a: "mot ".repeat(100) }).a).toHaveLength(100);
    expect(sanitizeProps({ a: "x".repeat(500) })).toEqual({});  // chaîne opaque longue : jamais transmise
    expect(sanitizeProps({ a: { nested: 1 }, b: undefined, c: NaN })).toEqual({});
  });
});

describe("createAnalytics", () => {
  it("transmet un événement nettoyé à chaque sink et survit à un sink défaillant", () => {
    const seen: unknown[] = [];
    const bad: AnalyticsSink = { name: "bad", track: () => { throw new Error("boom"); } };
    const good: AnalyticsSink = { name: "good", track: (e, p, c) => { seen.push([e, p, c.userId]); } };
    const a = createAnalytics({ sinks: [bad, good], platform: "ios", appVersion: "1.0.0", anonId: "anon" });
    a.setUser("u1");
    a.track("job_submitted", { price_cents: 484, email: "x@y.z" });
    expect(seen).toEqual([["job_submitted", { price_cents: 484 }, "u1"]]);
  });
  it("respecte le consentement", () => {
    const seen: unknown[] = [];
    const a = createAnalytics({ sinks: [{ name: "s", track: (e) => { seen.push(e); } }], platform: "web", appVersion: "1", anonId: "a", enabled: () => false });
    a.track("app_opened");
    expect(seen).toHaveLength(0);
  });
  it("expose tous les événements requis", () => {
    for (const e of ["app_opened", "signup_started", "job_submitted", "topup_completed", "account_deleted", "auto_reload_enabled", "payment_failed"]) expect(EVENTS).toContain(e);
  });
});

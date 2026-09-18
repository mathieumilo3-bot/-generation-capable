import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIpFrom, rateLimit, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("ip", 5, 60_000).allowed).toBe(true);
    }
  });

  it("blocks the request after the limit", () => {
    for (let i = 0; i < 5; i++) rateLimit("ip", 5, 60_000);
    const blocked = rateLimit("ip", 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each key separately", () => {
    for (let i = 0; i < 5; i++) rateLimit("ip-a", 5, 60_000);
    expect(rateLimit("ip-a", 5, 60_000).allowed).toBe(false);
    expect(rateLimit("ip-b", 5, 60_000).allowed).toBe(true);
  });

  it("lets the caller through again once the window has passed", () => {
    for (let i = 0; i < 5; i++) rateLimit("ip", 5, 60_000);
    expect(rateLimit("ip", 5, 60_000).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(rateLimit("ip", 5, 60_000).allowed).toBe(true);
  });

  it("reports the remaining allowance", () => {
    expect(rateLimit("ip", 3, 60_000).remaining).toBe(2);
    expect(rateLimit("ip", 3, 60_000).remaining).toBe(1);
    expect(rateLimit("ip", 3, 60_000).remaining).toBe(0);
  });

  it("keeps working past its tracking capacity without growing forever", () => {
    for (let i = 0; i < 6_000; i++) rateLimit(`ip-${i}`, 5, 60_000);
    // Still enforcing for a fresh key after the prune.
    for (let i = 0; i < 5; i++) rateLimit("survivor", 5, 60_000);
    expect(rateLimit("survivor", 5, 60_000).allowed).toBe(false);
  });
});

describe("clientIpFrom", () => {
  function requestWith(headers: Record<string, string>) {
    return new Request("https://exemple.fr/api/audit", { headers });
  }

  it("uses the first entry of x-forwarded-for", () => {
    expect(clientIpFrom(requestWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("trims whitespace around the address", () => {
    expect(clientIpFrom(requestWith({ "x-forwarded-for": "  1.2.3.4  " }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIpFrom(requestWith({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("falls back to the Netlify header", () => {
    expect(clientIpFrom(requestWith({ "x-nf-client-connection-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });

  it("returns a stable placeholder when no header is present", () => {
    expect(clientIpFrom(requestWith({}))).toBe("unknown");
  });
});

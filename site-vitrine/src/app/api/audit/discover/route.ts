import { NextResponse } from "next/server";
import { discoverCompany } from "@/lib/audit-engine/company-discovery";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 1024;
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
// Two search attempts (≤28 s + ≤18 s) + site verification, below the 60 s limit.
const DISCOVERY_TIMEOUT_MS = 58_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("company_discovery_timeout")), ms)
    ),
  ]);
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const limit = rateLimit(`audit-discover:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const companyName =
    typeof (payload as Record<string, unknown>).companyName === "string"
      ? ((payload as Record<string, unknown>).companyName as string).trim().slice(0, 160)
      : "";

  const cityHint =
    typeof (payload as Record<string, unknown>).cityHint === "string"
      ? ((payload as Record<string, unknown>).cityHint as string).trim().slice(0, 120)
      : "";

  if (companyName.length < 2) {
    return NextResponse.json({ error: "missing_company_name" }, { status: 422 });
  }

  try {
    const result = await withTimeout(
      discoverCompany(companyName, { cityHint }),
      DISCOVERY_TIMEOUT_MS
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[audit/discover] failed:", error);
    return NextResponse.json({ error: "discovery_failed" }, { status: 502 });
  }
}

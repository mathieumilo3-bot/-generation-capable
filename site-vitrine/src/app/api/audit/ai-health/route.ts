import { NextResponse } from "next/server";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

const MODEL = process.env.OPENAI_AUDIT_MODEL || "gpt-5.6-sol";
const PROJECT_ID = process.env.OPENAI_PROJECT_ID;

export async function GET(request: Request) {
  const ip = clientIpFrom(request);
  const limit = rateLimit(`audit-ai-health:${ip}`, 3, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, configured: false, model: MODEL }, { status: 503 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(PROJECT_ID ? { "OpenAI-Project": PROJECT_ID } : {}),
      },
      body: JSON.stringify({
        model: MODEL,
        input: "Réponds uniquement par OK.",
        max_output_tokens: 32,
      }),
    });

    let upstreamError: string | undefined;
    if (!response.ok) {
      try {
        const body = (await response.json()) as { error?: { type?: string; code?: string; message?: string } };
        upstreamError = body.error?.code || body.error?.type || body.error?.message;
      } catch {
        upstreamError = "openai_error";
      }
    }

    return NextResponse.json(
      {
        ok: response.ok,
        configured: true,
        model: MODEL,
        projectConfigured: Boolean(PROJECT_ID),
        upstreamStatus: response.status,
        upstreamError,
      },
      { status: response.ok ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        model: MODEL,
        upstreamStatus: null,
        upstreamError: error instanceof Error ? error.name : "network_error",
      },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { getNightShiftSnapshot, startNightShift, DEFAULT_PROMPT, PROJECTS } from "@/server/night-shift";

interface StartBody {
  prompt?: string;
  deadline?: string;
  projects?: string[];
}

export const dynamic = "force-dynamic";

const RUNTIME_URL = process.env.JARVIS_RUNTIME_URL?.replace(/\/$/, "");
const OWNER_TOKEN = process.env.JARVIS_OWNER_TOKEN;

function isAuthorized(request: Request): boolean {
  if (!OWNER_TOKEN) return true;
  return request.headers.get("authorization") === `Bearer ${OWNER_TOKEN}`;
}

async function proxyToRuntime(request: Request): Promise<Response> {
  if (!RUNTIME_URL) throw new Error("JARVIS_RUNTIME_URL is not configured.");
  if (!OWNER_TOKEN) throw new Error("JARVIS_OWNER_TOKEN is not configured.");

  const upstream = await fetch(`${RUNTIME_URL}/api/night-shift`, {
    method: request.method,
    headers: {
      authorization: `Bearer ${OWNER_TOKEN}`,
      ...(request.method !== "GET" ? { "content-type": "application/json" } : {}),
    },
    body: request.method === "GET" ? undefined : await request.text(),
    cache: "no-store",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(request: Request) {
  if (RUNTIME_URL) {
    try {
      return await proxyToRuntime(request);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return NextResponse.json({ error: `Runtime JARVIS indisponible: ${message}` }, { status: 502 });
    }
  }

  if (!isAuthorized(request)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  return NextResponse.json({ ...(await getNightShiftSnapshot()), defaults: { prompt: DEFAULT_PROMPT, projects: PROJECTS } });
}

export async function POST(request: Request) {
  if (RUNTIME_URL) {
    try {
      return await proxyToRuntime(request);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return NextResponse.json({ error: `Runtime JARVIS indisponible: ${message}` }, { status: 502 });
    }
  }

  if (!isAuthorized(request)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as StartBody | null;
  const prompt = body?.prompt?.trim() || DEFAULT_PROMPT;
  const projects = Array.isArray(body?.projects)
    ? body.projects.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : undefined;

  if (body?.deadline) {
    const deadlineMs = new Date(body.deadline).getTime();
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      return NextResponse.json({ error: "La deadline doit être une date future valide." }, { status: 400 });
    }
  }

  const input: { prompt: string; deadline?: string; projects?: string[] } = { prompt };
  if (body?.deadline) input.deadline = body.deadline;
  if (projects?.length) input.projects = projects;

  const runId = startNightShift(input);
  return NextResponse.json({ runId, ...(await getNightShiftSnapshot()) }, { status: 202 });
}

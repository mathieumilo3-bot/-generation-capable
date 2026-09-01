import { NextResponse } from "next/server";
import {
  getNightShiftSnapshot,
  resumeNightShiftOnBoot,
  startNightShift,
  DEFAULT_PROMPT,
  PROJECTS,
} from "@/server/night-shift";

interface StartBody {
  prompt?: string;
  deadline?: string;
  projects?: string[];
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Route-bound recovery avoids importing the Node-only Night Shift runtime from
  // Next's global instrumentation bundle while still recovering resumable work
  // whenever the persistent service receives traffic.
  resumeNightShiftOnBoot();
  return NextResponse.json({ ...(await getNightShiftSnapshot()), defaults: { prompt: DEFAULT_PROMPT, projects: PROJECTS } });
}

export async function POST(request: Request) {
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

import { NextResponse } from "next/server";
import { getNightShiftSnapshot, startNightShift, DEFAULT_PROMPT, PROJECTS } from "@/server/night-shift";

interface StartBody {
  prompt?: string;
  deadline?: string;
  projects?: string[];
}

export async function GET() {
  return NextResponse.json({ ...(await getNightShiftSnapshot()), defaults: { prompt: DEFAULT_PROMPT, projects: PROJECTS } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as StartBody | null;
  const prompt = body?.prompt?.trim();
  const projects = Array.isArray(body?.projects) ? body.projects.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : undefined;

  if (body?.deadline) {
    const deadlineMs = new Date(body.deadline).getTime();
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      return NextResponse.json({ error: "La deadline doit être une date future valide." }, { status: 400 });
    }
  }

  const runId = startNightShift({ prompt, deadline: body?.deadline, projects });
  return NextResponse.json({ runId, ...(await getNightShiftSnapshot()) }, { status: 202 });
}

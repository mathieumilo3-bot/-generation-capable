import type { ChatMessage } from "@gc-ai-os/model-provider";
import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

interface ChatRequestBody {
  message?: string;
  history?: ChatMessage[];
}

export async function GET() {
  const { modelMode } = getRuntime();
  return NextResponse.json({ modelMode });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ChatRequestBody | null;
  const message = body?.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "Le champ « message » est requis." }, { status: 400 });
  }

  const history = Array.isArray(body?.history) ? body.history : [];
  const { orchestrator, modelMode } = getRuntime();

  const reply = await orchestrator.handleMessage(message, history);

  return NextResponse.json({ ...reply, modelMode });
}

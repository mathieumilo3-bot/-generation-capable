import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "gc-ai-os",
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    time: new Date().toISOString(),
  });
}

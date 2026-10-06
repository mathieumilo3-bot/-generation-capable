import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGatewayAuth } from "@/server/engine-gateway/auth";
import { GatewayError, submit } from "@/server/engine-gateway/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  externalJobId: z.string().min(8).max(100), correlationId: z.string().max(100), kind: z.enum(["create", "revision"]),
  attempt: z.number().int().positive().optional(),
  inputs: z.array(z.object({
    assetId: z.string(), role: z.enum(["rush", "reference", "image", "logo", "audio_note"]), filename: z.string().max(255),
    mimeType: z.string(), sizeBytes: z.number().int().nonnegative(), url: z.string().url(), durationSec: z.number().nullable().optional(),
  })).max(60),
  brief: z.string().max(5000).nullable(), presetId: z.string(), useReferences: z.boolean(), aspectRatio: z.string(),
  targetDurationMaxSec: z.number().int().positive().max(3600),
  revision: z.object({ parentExternalJobId: z.string(), commands: z.array(z.string()).min(1).max(5) }).optional(),
});

/** Soumission idempotente par externalJobId (un retry de l'orchestrateur ne lance jamais un second rendu). */
export async function POST(request: Request): Promise<NextResponse> {
  const denied = requireGatewayAuth(request);
  if (denied) return denied;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  try {
    return NextResponse.json(submit(parsed.data), { status: 202 });
  } catch (e) {
    if (e instanceof GatewayError) return NextResponse.json({ error: e.code }, { status: e.status });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

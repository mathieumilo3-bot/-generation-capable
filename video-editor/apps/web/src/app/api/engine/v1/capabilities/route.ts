import { NextResponse } from "next/server";
import { requireGatewayAuth } from "@/server/engine-gateway/auth";
import { capabilities } from "@/server/engine-gateway/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const denied = requireGatewayAuth(request);
  if (denied) return denied;
  return NextResponse.json(capabilities());
}

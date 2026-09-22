import { NextResponse } from "next/server";
import { markLeadStage } from "@/lib/lead-tracking";

export async function POST(request: Request) {
  const form = await request.formData();
  const token = form.get("token");

  if (typeof token !== "string" || !token) {
    return NextResponse.redirect(new URL("/lead-status?result=invalid", request.url), 303);
  }

  try {
    const result = await markLeadStage(token);
    const suffix = result.ok && result.stage ? result.stage : "invalid";
    return NextResponse.redirect(new URL(`/lead-status?result=${suffix}`, request.url), 303);
  } catch (error) {
    console.error("[lead-status] update failed:", error);
    return NextResponse.redirect(new URL("/lead-status?result=error", request.url), 303);
  }
}

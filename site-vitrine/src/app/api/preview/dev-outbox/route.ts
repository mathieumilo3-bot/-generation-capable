import { NextResponse } from "next/server";
import { fixturesEnabled, outbox } from "@/lib/preview-engine/fixtures";

/** Offline e-mails sent in fixture mode (development and end-to-end tests only). */
export async function GET() {
  if (!fixturesEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ emails: outbox.slice(-20) }, { status: 200 });
}

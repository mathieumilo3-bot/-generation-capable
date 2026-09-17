import { NextResponse } from "next/server";

export type AuditSubmission = {
  siteUrl: string;
  secteur: string;
  objectif: string;
  nom: string;
  entreprise: string;
  email: string;
  telephone: string;
};

/**
 * No backend/CRM is wired up yet. This validates the shape and returns 200
 * so the frontend funnel has a real endpoint to call — swap the body of the
 * try block for a CRM write / email notification / Supabase insert later
 * without touching the client code.
 */
export async function POST(request: Request) {
  let body: Partial<AuditSubmission>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const required: (keyof AuditSubmission)[] = ["siteUrl", "secteur", "objectif", "email"];
  const missing = required.filter((key) => !body[key]);

  if (missing.length > 0) {
    return NextResponse.json({ error: "missing_fields", missing }, { status: 422 });
  }

  return NextResponse.json({ status: "received" }, { status: 200 });
}

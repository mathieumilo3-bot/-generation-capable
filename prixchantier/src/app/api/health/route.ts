import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "APP_URL",
    "CRON_SECRET",
    "TOKEN_ENCRYPTION_KEY",
    "OPENAI_MODEL",
  ] as const;

  const present = Object.fromEntries(keys.map((key) => [key, Boolean(process.env[key])]));
  const lengths = Object.fromEntries(keys.map((key) => [key, process.env[key]?.length ?? 0]));
  let tokenBytes = 0;
  try {
    tokenBytes = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64").length;
  } catch {}

  return NextResponse.json({ ok: true, present, lengths, tokenBytes });
}

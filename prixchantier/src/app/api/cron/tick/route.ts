import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { enqueue } from "@/lib/jobs/queue";
import { runJobs } from "@/lib/jobs/runner";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const POLL_EVERY_MS = 4 * 60_000;

function authorized(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env().CRON_SECRET}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Battement de cœur appelé chaque minute par Supabase Cron (pg_cron + pg_net).
 * Planifie la relève des boîtes et les relances échues, puis traite la file.
 */
async function tick(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = adminClient();
  const now = new Date();

  // Relève : seulement les boîtes ayant des consultations en cours.
  const { data: connections } = await admin
    .from("mail_connections")
    .select("id, organization_id, last_polled_at")
    .eq("status", "active");
  const { data: active } = await admin
    .from("consultations")
    .select("mail_connection_id")
    .not("status", "in", "(a_envoyer,annulee,erreur)")
    .gte("sent_at", new Date(now.getTime() - 90 * 86_400_000).toISOString());
  const withWork = new Set((active ?? []).map((c) => c.mail_connection_id));
  let polls = 0;
  for (const c of connections ?? []) {
    if (!withWork.has(c.id)) continue;
    if (c.last_polled_at && now.getTime() - new Date(c.last_polled_at).getTime() < POLL_EVERY_MS) continue;
    await enqueue("poll_mailbox", { connectionId: c.id }, { organizationId: c.organization_id, dedupeKey: `poll:${c.id}`, maxAttempts: 1 });
    polls++;
  }

  // Relances échues.
  const { data: due } = await admin
    .from("scheduled_followups")
    .select("id, organization_id")
    .eq("status", "scheduled")
    .lte("due_at", now.toISOString())
    .limit(200);
  for (const f of due ?? []) {
    await enqueue("send_followup", { followupId: f.id }, { organizationId: f.organization_id, dedupeKey: `followup:${f.id}` });
  }

  const { processed } = await runJobs({ deadlineMs: 240_000 });
  return NextResponse.json({ polls, followups: due?.length ?? 0, processed });
}

export const GET = tick;
export const POST = tick;

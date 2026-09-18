import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildConfirmationEmail,
  buildNotificationEmail,
  parseAuditSubmission,
  type AuditSubmission,
} from "@/lib/audit-submission";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/** Reject oversized bodies before parsing them. A real submission is < 1 KB. */
const MAX_BODY_BYTES = 8 * 1024;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const SEND_TIMEOUT_MS = 10_000;

const DEFAULT_FROM = "Génération Capable <audit@generationcapable.fr>";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}_timeout`)), ms)
    ),
  ]);
}

async function sendEmails(submission: AuditSubmission, apiKey: string, notifyEmail: string) {
  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const notification = buildNotificationEmail(submission);

  const sent = await withTimeout(
    resend.emails.send({
      from: fromEmail,
      to: notifyEmail,
      replyTo: submission.email,
      subject: notification.subject,
      text: notification.text,
      html: notification.html,
    }),
    SEND_TIMEOUT_MS,
    "notification"
  );

  if (sent.error) throw new Error(sent.error.message || "notification_failed");

  // Best effort: the business has been notified, so a failed courtesy copy to
  // the visitor must not turn their successful submission into an error.
  try {
    const confirmation = buildConfirmationEmail(submission);
    const copy = await withTimeout(
      resend.emails.send({
        from: fromEmail,
        to: submission.email,
        subject: confirmation.subject,
        text: confirmation.text,
        html: confirmation.html,
      }),
      SEND_TIMEOUT_MS,
      "confirmation"
    );
    if (copy.error) {
      console.error("[audit] confirmation email failed (non-blocking):", copy.error.message);
    }
  } catch (error) {
    console.error("[audit] confirmation email failed (non-blocking):", error);
  }
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const limit = rateLimit(`audit:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseAuditSubmission(payload);

  if (!parsed.ok) {
    // Answer a bot with the same success shape a human gets: no signal to
    // iterate against, and no email sent.
    if (parsed.error === "rejected_as_bot") {
      return NextResponse.json({ status: "received" }, { status: 200 });
    }
    const status = parsed.error === "invalid_payload" ? 400 : 422;
    return NextResponse.json(parsed, { status });
  }

  const submission = parsed.value;
  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.AUDIT_NOTIFY_EMAIL;

  if (!apiKey || !notifyEmail) {
    // In production this would silently swallow a real lead, so it has to
    // fail loudly. Locally it just logs, so the funnel stays testable
    // without secrets.
    if (process.env.NODE_ENV === "production") {
      console.error("[audit] RESEND_API_KEY / AUDIT_NOTIFY_EMAIL missing — submission dropped");
      return NextResponse.json({ error: "not_configured" }, { status: 500 });
    }
    console.warn(`[audit] email not configured — submission from ${submission.email} logged only`);
    return NextResponse.json({ status: "received", emailed: false }, { status: 200 });
  }

  try {
    await sendEmails(submission, apiKey, notifyEmail);
  } catch (error) {
    console.error("[audit] notification email failed:", error);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }

  return NextResponse.json({ status: "received", emailed: true }, { status: 200 });
}

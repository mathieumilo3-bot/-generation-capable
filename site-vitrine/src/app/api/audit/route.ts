import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildConfirmationEmail,
  buildNotificationEmail,
  parseAuditSubmission,
  parseReportEmailSummary,
  type AuditSubmission,
  type ReportEmailSummary,
} from "@/lib/audit-submission";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import {
  buildLeadActionLinks,
  createLeadMeta,
  upsertLeadContact,
  type LeadMeta,
} from "@/lib/lead-tracking";

/**
 * Reject oversized bodies before parsing them. A real submission is < 1 KB;
 * the optional diagnostic digest (see `reportSummary` below) adds at most a
 * couple more, so this stays generous rather than exact.
 */
const MAX_BODY_BYTES = 8 * 1024;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const SEND_TIMEOUT_MS = 10_000;

const DEFAULT_FROM = "GC <audit@generationcapable.fr>";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}_timeout`)), ms)
    ),
  ]);
}

async function sendEmails(
  submission: AuditSubmission,
  apiKey: string,
  notifyEmail: string,
  reportSummary: ReportEmailSummary | null,
  leadMeta: LeadMeta
) {
  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const baseNotification = buildNotificationEmail(submission, reportSummary);

  // Lead-status actions are useful enrichment, but they must never be able to
  // break the core notification path. A missing/invalid signing secret should
  // degrade to a normal lead email, not turn a captured lead into a 502.
  let actionText = "";
  let actionHtml = "";
  try {
    const actions = buildLeadActionLinks(submission.email, leadMeta.leadId);
    actionText = [
      "",
      "Qualifier ce lead :",
      `Lead qualifié : ${actions.qualified}`,
      `Rendez-vous pris : ${actions.booked}`,
      `Client gagné : ${actions.client}`,
    ].join("\n");
    actionHtml = `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #ddd;">
      <p style="margin:0 0 10px;font-weight:700;">Qualifier ce lead</p>
      <a href="${actions.qualified}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;margin:0 8px 8px 0;">Lead qualifié</a>
      <a href="${actions.booked}" style="display:inline-block;border:1px solid #111;color:#111;text-decoration:none;padding:9px 14px;border-radius:8px;margin:0 8px 8px 0;">RDV pris</a>
      <a href="${actions.client}" style="display:inline-block;border:1px solid #111;color:#111;text-decoration:none;padding:9px 14px;border-radius:8px;">Client gagné</a>
    </div>`;
  } catch (error) {
    console.error("[audit] lead action links unavailable (non-blocking):", error);
  }

  const notification = {
    ...baseNotification,
    text: baseNotification.text + actionText,
    html: actionHtml
      ? baseNotification.html.replace(/<\/div>$/, `${actionHtml}</div>`)
      : baseNotification.html,
  };

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
    const confirmation = buildConfirmationEmail(submission, reportSummary);
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
      return NextResponse.json({ status: "received", accepted: false, emailed: false }, { status: 200 });
    }
    const status = parsed.error === "invalid_payload" ? 400 : 422;
    return NextResponse.json(parsed, { status });
  }

  const submission = parsed.value;
  // Best-effort and purely cosmetic for the inbox: absent or malformed, the
  // lead is captured exactly the same either way.
  const reportSummary = parseReportEmailSummary(
    (payload as Record<string, unknown>).reportSummary
  );
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
    return NextResponse.json({ status: "received", accepted: true, emailed: false }, { status: 200 });
  }

  const leadMeta = createLeadMeta();
  let leadStored = false;

  try {
    await upsertLeadContact(submission, leadMeta);
    leadStored = true;
  } catch (error) {
    console.error("[audit] lead CRM sync failed:", error);
  }

  try {
    await sendEmails(submission, apiKey, notifyEmail, reportSummary, leadMeta);
  } catch (error) {
    console.error("[audit] notification email failed:", error);

    // If Resend already persisted the contact, the business still owns a
    // recoverable lead with attribution. Do not strand the visitor on an
    // error page or suppress the ad conversion just because notification
    // delivery had a temporary/configuration failure.
    if (leadStored) {
      return NextResponse.json(
        { status: "received", accepted: true, emailed: false },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: "lead_capture_failed" }, { status: 502 });
  }

  return NextResponse.json({ status: "received", accepted: true, emailed: true }, { status: 200 });
}

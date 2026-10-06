import { renderEmail, type EmailKind } from "../../../supabase/functions/_shared/emails.ts";
import { sendEmail, type MailerConfig } from "../../../supabase/functions/_shared/mailer.ts";
import type { Store } from "./store.ts";

const KIND_BY_NOTIFICATION: Record<string, EmailKind> = {
  video_ready: "video_ready", revision_ready: "revision_ready", job_failed: "job_failed", topup_done: "topup_done", payment_failed: "payment_failed",
};

export async function sendPendingEmails(store: Store, o: { mailer: MailerConfig; retentionHours?: number; brand: string; supportEmail: string; webUrl: string; limit?: number; log?: (l: "info" | "warn" | "error", m: string, d?: Record<string, unknown>) => void }): Promise<number> {
  let sent = 0;
  for (const m of await store.pendingEmails(o.limit ?? 25)) {
    try {
      const notifKind = m.kind === "welcome" ? "welcome" : KIND_BY_NOTIFICATION[String(m.data.kind)];
      if (!notifKind) { await store.markEmailSent(m.kind, m.ref_id); continue; }
      const deep = typeof m.data.deep_link === "string" ? m.data.deep_link.replace(/^\/+/, "") : "";
      const amount = /^([\d\s  ]+,\d{2}\s?€)/.exec(m.body)?.[1] ?? null;
      const mail = renderEmail(notifKind, {
        brand: o.brand, supportEmail: o.supportEmail, firstName: m.first_name,
        ctaUrl: `${o.webUrl.replace(/\/$/, "")}/${deep}`, amountLabel: amount, retentionHours: o.retentionHours,
      });
      await sendEmail(o.mailer, { to: m.email, ...mail, idempotencyKey: `${m.kind}:${m.ref_id}` });
      await store.markEmailSent(m.kind, m.ref_id);
      sent++;
    } catch (e) { o.log?.("warn", "e-mail non envoyé", { ref: m.ref_id, error: (e as Error).message }); }
  }
  return sent;
}

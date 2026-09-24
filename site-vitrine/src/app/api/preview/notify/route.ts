import { NextResponse } from "next/server";
import { Resend } from "resend";
import { registerAuditLead } from "@/lib/audit-leads";
import { publicStatus } from "@/lib/preview-engine/pipeline";
import { attributionFrom, pipelineDeps, readJson, requireStore, text } from "@/lib/preview-engine/service";
import { verifyPreviewToken } from "@/lib/preview-engine/tokens";
import { previewMode } from "@/lib/preview-engine/version";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

/**
 * "Send it to me": attaches an e-mail to a preview so it can be delivered
 * once ready, even if the visitor closes the page. The address is used for
 * THIS preview only (no marketing opt-in here), exactly like the audit's
 * "prévenez-moi". The lead is also recorded in the existing audit lead table
 * so the current follow-up keeps seeing it.
 */
export async function POST(request: Request) {
  if (previewMode() === "off") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const limit = rateLimit(`preview-notify:${clientIpFrom(request)}`, 12, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await readJson(request, 4 * 1024);
  if (!body || !verifyPreviewToken(body.id, body.token)) return NextResponse.json({ error: "invalid_preview" }, { status: 400 });
  const email = text(body, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return NextResponse.json({ error: "invalid_email" }, { status: 422 });

  const store = requireStore();
  if (!store) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  const row = await store.get(body.id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const lead = await registerAuditLead({
    companyName: row.company_name || row.input.companyName,
    companyCity: row.work?.registry?.city || row.work?.discovery?.city || "",
    siteUrl: row.work?.discovery?.website || "",
    email,
    phone: "",
    marketingConsent: false,
    attribution: { ...attributionFrom(body), flow: "preview_v2", preview_id: row.id },
  });
  if (!(await store.setEmail(row.id, email, lead?.id ?? null))) return NextResponse.json({ error: "storage_failed" }, { status: 503 });

  // Transactional capture alert for GC (same as the audit funnel), skipped for test addresses.
  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.AUDIT_NOTIFY_EMAIL;
  if (apiKey && notifyEmail && !/@example\.(?:com|org|net)$|@resend\.dev$/.test(email)) {
    void new Resend(apiKey).emails
      .send({
        from: process.env.RESEND_FROM_EMAIL || "GC <audit@generationcapable.fr>",
        to: notifyEmail,
        subject: `Contact vitrine V2 capturé — ${row.company_name || row.input.companyName}`,
        text: [`Entreprise : ${row.company_name || row.input.companyName}`, `Email : ${email}`, `Preview : ${row.id}`, "Opt-in marketing : non"].join("\n"),
      })
      .catch(() => {});
  }

  // Already ready: deliver now instead of waiting for the worker.
  let sent = false;
  if (row.status === "ready") {
    const fresh = { ...row, email };
    if (await store.markNotified(row.id)) sent = await pipelineDeps(store).sendReadyEmail(fresh);
  }
  return NextResponse.json({ status: "registered", sent, preview: publicStatus({ ...row, email }) }, { status: 200 });
}

import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  attachAuditJob,
  completeAuditJob,
  getStoredAuditResult,
  registerAuditLead,
} from "@/lib/audit-leads";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 12;
const DEFAULT_FROM = "GC <audit@generationcapable.fr>";

function text(source: Record<string, unknown>, key: string, max: number): string {
  const value = source[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function bool(source: Record<string, unknown>, key: string): boolean {
  return source[key] === true;
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanPhone(value: string): string {
  return value.replace(/[^+\d .()-]/g, "").trim().slice(0, 40);
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const limit = rateLimit(`audit-contact:${ip}`, RATE_MAX, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const source = payload as Record<string, unknown>;
  const action = text(source, "action", 24);

  if (action === "register") {
    const companyName = text(source, "companyName", 160);
    const companyCity = text(source, "companyCity", 120);
    const siteUrl = text(source, "siteUrl", 300);
    const email = text(source, "email", 254).toLowerCase();
    const marketingConsent = bool(source, "marketingConsent");
    const phone = marketingConsent ? cleanPhone(text(source, "phone", 40)) : "";

    if (companyName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "invalid_fields" }, { status: 422 });
    }

    const attribution =
      source.attribution && typeof source.attribution === "object" && !Array.isArray(source.attribution)
        ? source.attribution as Record<string, unknown>
        : {};

    const handle = await registerAuditLead({
      companyName,
      companyCity,
      siteUrl,
      email,
      phone,
      marketingConsent,
      attribution,
    });
    if (!handle) return NextResponse.json({ error: "storage_failed" }, { status: 503 });

    // Transactional capture alert for GC. This is not a marketing send.
    const apiKey = process.env.RESEND_API_KEY;
    const notifyEmail = process.env.AUDIT_NOTIFY_EMAIL;
    if (apiKey && notifyEmail) {
      const resend = new Resend(apiKey);
      const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
      const lines = [
        `Entreprise : ${companyName}`,
        `Ville : ${companyCity || "-"}`,
        `Email : ${email}`,
        `Téléphone : ${phone || "-"}`,
        `Opt-in marketing : ${marketingConsent ? "oui" : "non"}`,
      ];
      void resend.emails.send({
        from,
        to: notifyEmail,
        subject: `Contact audit capturé — ${companyName}`,
        text: ["Un visiteur a demandé à être prévenu quand son diagnostic est prêt.", "", ...lines].join("\n"),
      });

      // Only explicit marketing opt-ins are added to the broadcast contact base.
      if (marketingConsent) {
        const segmentId = process.env.GC_AUDIT_RESEND_SEGMENT_ID;
        try {
          await resend.contacts.create({
            email,
            unsubscribed: false,
            ...(segmentId ? { segmentIds: [segmentId] } : {}),
          });
        } catch (error) {
          console.error("[audit/contact] resend contact sync failed:", error);
        }
      }
    }

    const response = NextResponse.json({ status: "registered", id: handle.id, token: handle.lead_token }, { status: 200 });
    response.cookies.set("gc_audit_request", handle.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
    return response;
  }

  if (action === "attach") {
    const id = text(source, "id", 80);
    const token = text(source, "token", 80);
    const signature = text(source, "signature", 128);
    const jobId = text(source, "jobId", 180);
    const jobToken = text(source, "jobToken", 256);
    if (!validUuid(id) || !validUuid(token) || !source.context || !signature || !jobId || !jobToken) {
      return NextResponse.json({ error: "invalid_fields" }, { status: 422 });
    }

    const result = await attachAuditJob({
      id,
      token,
      context: source.context,
      signature,
      jobId,
      jobToken,
    });
    return NextResponse.json({ status: result.data === true ? "attached" : "not_found" }, { status: result.data === true ? 200 : 404 });
  }

  if (action === "complete") {
    const id = text(source, "id", 80);
    const token = text(source, "token", 80);
    if (!validUuid(id) || !validUuid(token) || !source.report || typeof source.report !== "object") {
      return NextResponse.json({ error: "invalid_fields" }, { status: 422 });
    }
    const result = await completeAuditJob({ id, token, report: source.report });
    return NextResponse.json({ status: result.data === true ? "ready" : "not_found" }, { status: result.data === true ? 200 : 404 });
  }

  if (action === "result") {
    const id = text(source, "id", 80);
    const token = text(source, "token", 80);
    if (!validUuid(id) || !validUuid(token)) {
      return NextResponse.json({ error: "invalid_fields" }, { status: 422 });
    }
    const stored = await getStoredAuditResult({ id, token });
    const row = stored.data?.[0];
    if (!row?.report) return NextResponse.json({ status: "pending" }, { status: 200 });
    return NextResponse.json({
      status: "ready",
      report: row.report,
      entreprise: row.company_name,
      siteUrl: row.site_url,
      ville: row.company_city,
    });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}

import { NextResponse } from "next/server";
import { Resend } from "resend";

export type AuditSubmission = {
  siteUrl: string;
  secteur: string;
  objectif: string;
  nom: string;
  entreprise: string;
  email: string;
  telephone: string;
};

const REQUIRED_FIELDS: (keyof AuditSubmission)[] = ["siteUrl", "secteur", "objectif", "email"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function buildNotificationEmail(data: AuditSubmission) {
  const rows: [string, string][] = [
    ["Site", data.siteUrl],
    ["Secteur", data.secteur],
    ["Objectif", data.objectif],
    ["Nom", data.nom || "—"],
    ["Entreprise", data.entreprise || "—"],
    ["Email", data.email],
    ["Téléphone", data.telephone || "—"],
  ];

  const text = rows.map(([label, value]) => `${label} : ${value}`).join("\n");
  const html = `
    <div style="font-family: sans-serif; color: #111;">
      <h2 style="margin-bottom: 16px;">Nouvelle demande Capable Audit</h2>
      <table cellpadding="6" style="border-collapse: collapse;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="color:#666; padding-right: 16px;">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`
          )
          .join("")}
      </table>
    </div>
  `;

  return { text, html };
}

/**
 * Wired to a real Resend sending domain (generationcapable.fr). Requires
 * RESEND_API_KEY and AUDIT_NOTIFY_EMAIL at runtime — without them the route
 * still validates input but skips sending (logs instead), so local dev
 * without secrets doesn't break. See README for setup.
 */
export async function POST(request: Request) {
  let body: Partial<AuditSubmission>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const missing = REQUIRED_FIELDS.filter((key) => !body[key]?.toString().trim());
  if (missing.length > 0) {
    return NextResponse.json({ error: "missing_fields", missing }, { status: 422 });
  }

  const email = body.email!.toString().trim();
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 422 });
  }

  const submission: AuditSubmission = {
    siteUrl: body.siteUrl!.toString().trim(),
    secteur: body.secteur!.toString().trim(),
    objectif: body.objectif!.toString().trim(),
    nom: (body.nom ?? "").toString().trim(),
    entreprise: (body.entreprise ?? "").toString().trim(),
    email,
    telephone: (body.telephone ?? "").toString().trim(),
  };

  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.AUDIT_NOTIFY_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Génération Capable <audit@generationcapable.fr>";

  if (!apiKey || !notifyEmail) {
    console.warn(
      "[audit] RESEND_API_KEY or AUDIT_NOTIFY_EMAIL not set — submission received but no email sent:",
      submission
    );
    return NextResponse.json({ status: "received", emailed: false }, { status: 200 });
  }

  const resend = new Resend(apiKey);
  const { text, html } = buildNotificationEmail(submission);

  const notification = await resend.emails.send({
    from: fromEmail,
    to: notifyEmail,
    replyTo: submission.email,
    subject: `Nouvelle demande d'audit — ${submission.entreprise || submission.nom || submission.email}`,
    text,
    html,
  });

  if (notification.error) {
    console.error("[audit] Resend notification failed:", notification.error);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }

  // Confirmation to the lead is best-effort: the lead's own submission
  // already succeeded (the business was notified), so a failure here
  // shouldn't surface as an error to the visitor.
  const confirmation = await resend.emails.send({
    from: fromEmail,
    to: submission.email,
    subject: "Votre demande d'audit a bien été reçue",
    text: `Bonjour${submission.nom ? " " + submission.nom : ""},\n\nNous avons bien reçu votre demande d'audit pour ${submission.siteUrl}. Nous revenons vers vous rapidement avec les opportunités prioritaires identifiées.\n\nGénération Capable`,
    html: `<p>Bonjour${submission.nom ? " " + escapeHtml(submission.nom) : ""},</p><p>Nous avons bien reçu votre demande d'audit pour <strong>${escapeHtml(submission.siteUrl)}</strong>. Nous revenons vers vous rapidement avec les opportunités prioritaires identifiées.</p><p>Génération Capable</p>`,
  });

  if (confirmation.error) {
    console.error("[audit] Resend confirmation failed (non-blocking):", confirmation.error);
  }

  return NextResponse.json({ status: "received", emailed: true }, { status: 200 });
}

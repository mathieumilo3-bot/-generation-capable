export type AuditSubmission = {
  siteUrl: string;
  secteur: string;
  objectif: string;
  nom: string;
  entreprise: string;
  email: string;
  telephone: string;
};

export type ParseResult =
  | { ok: true; value: AuditSubmission }
  | { ok: false; error: "invalid_payload" }
  | { ok: false; error: "missing_fields"; missing: string[] }
  | { ok: false; error: "invalid_email" }
  | { ok: false; error: "field_too_long"; field: string }
  | { ok: false; error: "rejected_as_bot" };

/** Max accepted length per field, chosen to fit a real submission with room to spare. */
export const FIELD_LIMITS: Record<keyof AuditSubmission, number> = {
  siteUrl: 300,
  secteur: 80,
  objectif: 80,
  nom: 120,
  entreprise: 160,
  email: 254,
  telephone: 40,
};

/** Name of the hidden field real visitors never fill — bots usually do. */
export const HONEYPOT_FIELD = "site_web_confirmation";

const REQUIRED_FIELDS: (keyof AuditSubmission)[] = ["siteUrl", "secteur", "objectif", "email"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function escapeHtml(value: string): string {
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

/** Strips CR/LF and other control characters that have no place in a header. */
function sanitizeHeaderValue(value: string): string {
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? " " : char;
    })
    .join("")
    .trim();
}

function readString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  return typeof value === "string" ? value.trim() : "";
}

export function parseAuditSubmission(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "invalid_payload" };
  }

  const source = raw as Record<string, unknown>;

  // A filled honeypot means a bot: report it separately so the caller can
  // answer with a normal success and avoid teaching the bot what failed.
  if (readString(source, HONEYPOT_FIELD).length > 0) {
    return { ok: false, error: "rejected_as_bot" };
  }

  const candidate: AuditSubmission = {
    siteUrl: readString(source, "siteUrl"),
    secteur: readString(source, "secteur"),
    objectif: readString(source, "objectif"),
    nom: readString(source, "nom"),
    entreprise: readString(source, "entreprise"),
    email: readString(source, "email").toLowerCase(),
    telephone: readString(source, "telephone"),
  };

  for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
    if (candidate[field as keyof AuditSubmission].length > limit) {
      return { ok: false, error: "field_too_long", field };
    }
  }

  const missing = REQUIRED_FIELDS.filter((field) => candidate[field].length === 0);
  if (missing.length > 0) {
    return { ok: false, error: "missing_fields", missing };
  }

  if (!EMAIL_PATTERN.test(candidate.email)) {
    return { ok: false, error: "invalid_email" };
  }

  return { ok: true, value: candidate };
}

export function buildNotificationEmail(data: AuditSubmission) {
  const rows: [string, string][] = [
    ["Site", data.siteUrl],
    ["Secteur", data.secteur],
    ["Objectif", data.objectif],
    ["Nom", data.nom || "—"],
    ["Entreprise", data.entreprise || "—"],
    ["Email", data.email],
    ["Téléphone", data.telephone || "—"],
  ];

  const subject = sanitizeHeaderValue(
    `Nouvelle demande d'audit — ${data.entreprise || data.nom || data.email}`
  );

  const text = rows.map(([label, value]) => `${label} : ${value}`).join("\n");

  const html = `<div style="font-family: sans-serif; color: #111;">
  <h2 style="margin-bottom: 16px;">Nouvelle demande Capable Audit</h2>
  <table cellpadding="6" style="border-collapse: collapse;">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="color:#666; padding-right: 16px;">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`
      )
      .join("")}
  </table>
</div>`;

  return { subject, text, html };
}

export function buildConfirmationEmail(data: AuditSubmission) {
  const greeting = data.nom ? `Bonjour ${data.nom},` : "Bonjour,";

  const text = `${greeting}

Nous avons bien reçu votre demande d'audit pour ${data.siteUrl}. Nous revenons vers vous rapidement avec les opportunités prioritaires identifiées.

Génération Capable`;

  const html = `<p>${escapeHtml(greeting)}</p>
<p>Nous avons bien reçu votre demande d'audit pour <strong>${escapeHtml(data.siteUrl)}</strong>. Nous revenons vers vous rapidement avec les opportunités prioritaires identifiées.</p>
<p>Génération Capable</p>`;

  return { subject: "Votre demande d'audit a bien été reçue", text, html };
}

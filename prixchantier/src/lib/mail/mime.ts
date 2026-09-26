import { randomBytes } from "node:crypto";
import type { OutgoingMessage } from "./types";

/** Supprime tout retour à la ligne : empêche l'injection d'en-têtes. */
export function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Encodage RFC 2047 si nécessaire. */
export function encodeHeader(value: string): string {
  const v = headerSafe(value);
  if (/^[\x20-\x7e]*$/.test(v)) return v;
  return `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

export function formatAddress(email: string, name?: string | null) {
  const e = headerSafe(email);
  if (!name) return `<${e}>`;
  return `${encodeHeader(`"${name.replace(/"/g, "'")}"`)} <${e}>`;
}

function wrap76(b64: string) {
  return b64.replace(/.{1,76}/g, "$&\r\n");
}

/** Message RFC 5322 multipart/mixed (texte + pièces jointes), prêt pour Gmail. */
export function buildMime(msg: OutgoingMessage, messageIdDomain = "prixchantier.app"): { raw: string; messageId: string } {
  const boundary = `pc_${randomBytes(12).toString("hex")}`;
  const messageId = `<${randomBytes(16).toString("hex")}@${messageIdDomain}>`;
  const headers = [
    `From: ${formatAddress(msg.fromEmail, msg.fromName)}`,
    `To: ${formatAddress(msg.to, msg.toName)}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
  ];
  if (msg.replyTo?.internetMessageId) {
    const ref = headerSafe(msg.replyTo.internetMessageId);
    headers.push(`In-Reply-To: ${ref}`, `References: ${ref}`);
  }
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  const parts = [
    [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrap76(Buffer.from(msg.text, "utf8").toString("base64")),
    ].join("\r\n"),
    ...msg.attachments.map((a) => {
      const safeName = headerSafe(a.filename).replace(/"/g, "'");
      return [
        `--${boundary}`,
        `Content-Type: ${headerSafe(a.contentType)}; name="${encodeHeader(safeName)}"`,
        `Content-Disposition: attachment; filename="${encodeHeader(safeName)}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Content-Transfer-Encoding: base64",
        "",
        wrap76(a.content.toString("base64")),
      ].join("\r\n");
    }),
  ];
  return { raw: `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}\r\n--${boundary}--\r\n`, messageId };
}

/** « Jean Dupont <jean@x.fr> » → { email, name } */
export function parseAddress(value: string | null | undefined): { email: string; name: string | null } {
  if (!value) return { email: "", name: null };
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  if (m) return { email: m[2].trim().toLowerCase(), name: m[1].trim() || null };
  return { email: value.trim().toLowerCase(), name: null };
}

/** Texte lisible à partir d'un corps HTML (fallback quand aucun text/plain). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

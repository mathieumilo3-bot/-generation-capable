/** Envoi via l'API Resend (clé serveur). Idempotence par en-tête : un retry ne renvoie jamais deux fois. */
export interface MailerConfig { apiKey: string; from: string; fetchImpl?: typeof fetch }

export async function sendEmail(c: MailerConfig, m: { to: string; subject: string; html: string; text: string; idempotencyKey: string }): Promise<void> {
  const f = c.fetchImpl ?? fetch;
  const res = await f("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${c.apiKey}`, "content-type": "application/json", "idempotency-key": m.idempotencyKey },
    body: JSON.stringify({ from: c.from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
  });
  if (!res.ok) throw new Error(`email_failed:${res.status}`);
}

import type { PreviewRow } from "./store";
import { previewToken } from "./tokens";

/**
 * The "your preview is ready" e-mail. Transactional only: sent because the
 * visitor asked to receive THIS preview, never used for prospecting. The
 * Resend idempotency key makes a double trigger (browser + worker) harmless.
 */

const DEFAULT_FROM = "GC <audit@generationcapable.fr>";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function previewLink(row: Pick<PreviewRow, "id" | "input">, fallbackOrigin: string): string {
  const origin = (row.input as { origin?: string }).origin || fallbackOrigin;
  return `${origin}/audit/reprendre#preview=${encodeURIComponent(row.id)}&t=${encodeURIComponent(previewToken(row.id))}`;
}

export function readyEmail(row: Pick<PreviewRow, "id" | "input" | "company_name">, fallbackOrigin: string) {
  const link = previewLink(row, fallbackOrigin);
  const name = row.company_name || row.input.companyName;
  return {
    subject: `Votre nouvelle vitrine est prête — ${name}`,
    text: ["Votre proposition personnalisée est prête.", "", "Voir ma nouvelle vitrine :", link, "", "Vous recevez ce message parce que vous avez demandé à recevoir cette proposition."].join("\n"),
    html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#16150f;max-width:520px">
  <p style="margin:0 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#6b6861">${escapeHtml(name)}</p>
  <h1 style="margin:0 0 14px;font-size:22px">Votre proposition personnalisée est prête.</h1>
  <p style="margin:26px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#16150f;color:#fff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:bold">Voir ma nouvelle vitrine →</a></p>
  <p style="font-size:12px;color:#6b6861">Vous recevez ce message parce que vous avez demandé à recevoir cette proposition.</p>
</div>`,
  };
}

export async function sendPreviewReadyEmail(row: PreviewRow, fallbackOrigin: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !row.email) return false;
  const message = readyEmail(row, fallbackOrigin);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `gc-preview-ready-${row.id}` },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM, to: [row.email], ...message }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) console.error("[preview/email] send failed:", response.status);
    return response.ok;
  } catch (error) {
    console.error("[preview/email] send error:", error instanceof Error ? error.name : "unknown");
    return false;
  }
}

const OBJECTIVE =
  "Augmenter la visibilité qualifiée et la transformer en davantage de demandes de devis et de prospects qualifiés.";

function env(name) {
  return process.env[name] || "";
}

async function rpc(name, args) {
  const url = env("GC_AUDIT_SUPABASE_URL");
  const key = env("GC_AUDIT_SUPABASE_KEY");
  const secret = env("GC_AUDIT_RPC_SECRET");
  if (!url || !key || !secret) throw new Error("audit_storage_unconfigured");

  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_secret: secret, ...args }),
  });
  if (!response.ok) {
    throw new Error(`rpc_${name}_${response.status}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function pollReport(row) {
  if (!row.audit_context || !row.audit_signature || !row.openai_job_id || !row.openai_job_token) {
    return null;
  }
  const response = await fetch("https://gc-agence.com/api/audit/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: row.audit_context,
      signature: row.audit_signature,
      jobId: row.openai_job_id,
      token: row.openai_job_token,
      objectif: OBJECTIVE,
    }),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.status === "done" && payload.report ? payload.report : null;
}

async function sendReadyEmail(row) {
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey || !row.email) return false;

  const from = env("RESEND_FROM_EMAIL") || "GC <audit@generationcapable.fr>";
  const link = `https://gc-agence.com/audit/reprendre#id=${encodeURIComponent(row.id)}&token=${encodeURIComponent(row.lead_token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `gc-audit-ready-${row.id}`,
    },
    body: JSON.stringify({
      from,
      to: [row.email],
      subject: `Votre diagnostic GC est prêt — ${row.company_name}`,
      text: [
        `Le diagnostic de ${row.company_name} est prêt.`,
        "",
        "Ouvrez votre analyse :",
        link,
        "",
        "Ce message vous est envoyé parce que vous avez demandé à être prévenu quand l'analyse serait terminée.",
      ].join("\n"),
      html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.55;color:#111">
        <h2 style="margin:0 0 12px">Votre diagnostic est prêt.</h2>
        <p>L’analyse de <strong>${escapeHtml(row.company_name)}</strong> est terminée.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px">Voir mon diagnostic</a>
        </p>
        <p style="font-size:12px;color:#666">Vous recevez ce message parce que vous avez demandé à être prévenu lorsque votre analyse serait terminée.</p>
      </div>`,
    }),
  });
  return response.ok;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] || char);
}

export default async () => {
  let rows;
  try {
    rows = await rpc("gc_worker_get_audits", { p_limit: 12 });
  } catch (error) {
    console.error("[audit-ready-cron] list failed", error);
    return new Response("storage unavailable", { status: 200 });
  }

  for (const row of Array.isArray(rows) ? rows : []) {
    try {
      let report = row.report || null;

      if (!report && row.status === "processing") {
        report = await pollReport(row);
        if (!report) continue;
        await rpc("gc_worker_set_ready", { p_id: row.id, p_report: report });
      }

      if (!report) continue;
      const sent = await sendReadyEmail(row);
      if (sent) {
        await rpc("gc_worker_mark_notified", { p_id: row.id });
      }
    } catch (error) {
      console.error("[audit-ready-cron] row failed", row?.id, error);
    }
  }

  await advancePreviews();
  return new Response("ok", { status: 200 });
};

/**
 * GC Preview Engine V2: moves forward the previews whose visitor left the
 * page and delivers the "ready" e-mails still owed. Opt-in (GC_PREVIEW_V2_WORKER=1)
 * so enabling the V2 never changes the audit flow above. Never throws.
 */
async function advancePreviews() {
  if (env("GC_PREVIEW_V2_WORKER") !== "1") return;
  const secret = env("PREVIEW_WORKER_SECRET") || env("GC_AUDIT_RPC_SECRET");
  const base = env("GC_PREVIEW_WORKER_URL") || "https://gc-agence.com";
  if (!secret) return;
  try {
    const response = await fetch(`${base}/api/preview/worker`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(9_500),
    });
    if (!response.ok) console.error("[audit-ready-cron] preview worker", response.status);
  } catch (error) {
    console.error("[audit-ready-cron] preview worker failed", error);
  }
}

export const config = {
  schedule: "* * * * *",
};

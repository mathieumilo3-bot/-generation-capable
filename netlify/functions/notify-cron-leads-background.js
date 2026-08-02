// netlify/functions/notify-cron-leads-background.js
//
// Séquence email des prospects anonymes (mission "3. Notifications
// Prospect") : 30 minutes / 24 heures / 3 jours / 7 jours après capture,
// ancrée sur marketing_leads.created_at (pas sur l'heure d'envoi réelle,
// pour ne jamais dériver si un passage de cron est en retard). Tourne
// toutes les 15 minutes (voir netlify.toml).
//
// Un lead devenu client (checkout.session.completed avec le même email —
// voir stripe-webhook.js) sort immédiatement de la séquence : la requête
// ci-dessous filtre "converted = false".

const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { LEAD_EMAIL_TEMPLATES } = require('./_lib/notifications/templates');
const { sendLeadEmail, unsubscribeFooter } = require('./_lib/notifications/email');
const { mapWithConcurrency } = require('./_lib/notifications/concurrency');

const MAX_LEADS_PER_TICK = Number(process.env.MAX_LEADS_PER_TICK || 500);
const CONCURRENCY = 10;

// Décalages depuis marketing_leads.created_at pour chaque étape (1 à 4).
const STEP_OFFSET_MS = {
  1: 30 * 60 * 1000,
  2: 24 * 3600 * 1000,
  3: 3 * 24 * 3600 * 1000,
  4: 7 * 24 * 3600 * 1000,
};

async function fetchDueLeads() {
  const nowIso = new Date().toISOString();
  const r = await supabaseAdminRequest(
    `/rest/v1/marketing_leads?converted=eq.false&stopped=eq.false&sequence_step=lt.4&next_send_at=lte.${nowIso}&select=id,email,first_name,created_at,sequence_step&order=next_send_at.asc&limit=${MAX_LEADS_PER_TICK}`
  );
  if (!r.ok) return [];
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

async function processLead(lead) {
  const nextStep = lead.sequence_step + 1;
  const pool = LEAD_EMAIL_TEMPLATES[nextStep];
  if (!pool) return;
  const render = pool[Math.floor(Math.random() * pool.length)];
  const { subject, html } = render({ prenom: lead.first_name });
  const fullHtml = html + unsubscribeFooter(lead.id);

  const result = await sendLeadEmail({ to: lead.email, subject, html: fullHtml });
  if (!result.ok) return; // on retentera au prochain passage (next_send_at inchangé)

  const createdAt = new Date(lead.created_at).getTime();
  const isLastStep = nextStep >= 4;
  const patch = {
    sequence_step: nextStep,
    next_send_at: isLastStep ? null : new Date(createdAt + STEP_OFFSET_MS[nextStep + 1]).toISOString(),
    stopped: isLastStep ? true : false,
  };
  await supabaseAdminRequest(`/rest/v1/marketing_leads?id=eq.${lead.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

exports.handler = async () => {
  const leads = await fetchDueLeads();
  await mapWithConcurrency(leads, CONCURRENCY, processLead);
  return jsonResponse(200, { processed: leads.length });
};

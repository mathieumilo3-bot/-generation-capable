// netlify/functions/notify-cron-crm-scan-background.js
//
// Alertes admin "Commercial" (mission section 1) : nouveau prospect
// qualifié, rendez-vous pris, devis envoyé, vente en attente, prospect
// chaud sans suivi. Tourne toutes les 10 minutes (voir netlify.toml).
//
// Ces évènements naissent d'écritures faites directement par le navigateur
// vendeur via les fonctions RPC Supabase (advance_prospect_stage, etc. —
// voir 0006_crm_orders_wallet_marketplace.sql), pas via une Netlify
// Function : il n'y a donc pas de point d'interception synchrone côté
// serveur pour ces évènements précis. Un scan périodique avec curseur
// (notification_cron_state) est le compromis le plus simple qui reste
// fiable — quasi temps réel (≤10 min de latence), sans dépendre d'un
// webhook base de données (non configuré sur ce projet).
//
// "Devis envoyé" et "Proposition commerciale envoyée" ne sont PAS
// distingués dans le schéma actuel (une seule étape "quote_sent") — voir
// docs/notifications-system.md pour ce qui n'est pas câblé.

const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { notifyAdmins, safeNotify } = require('./_lib/notifications/send');
const { isoWeekKey } = require('./_lib/notifications/time');

const JOB_NAME = 'crm_scan';
const STALE_PROSPECT_HOURS = Number(process.env.PROSPECT_STALE_HOURS || 48);
const STALE_ORDER_HOURS = Number(process.env.PENDING_ORDER_STALE_HOURS || 24);

async function getCursor() {
  const r = await supabaseAdminRequest(`/rest/v1/notification_cron_state?job_name=eq.${JOB_NAME}&select=last_run_at`);
  const rows = r.ok ? await r.json() : [];
  if (rows && rows[0]) return rows[0].last_run_at;
  return new Date(Date.now() - 3600 * 1000).toISOString();
}

async function setCursor(iso) {
  await supabaseAdminRequest('/rest/v1/notification_cron_state?on_conflict=job_name', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ job_name: JOB_NAME, last_run_at: iso }),
  });
}

async function scanStageTransitions(sinceIso, nowIso) {
  const r = await supabaseAdminRequest(
    `/rest/v1/prospect_stage_history?created_at=gt.${sinceIso}&created_at=lte.${nowIso}&select=id,prospect_id,to_stage,created_at&order=created_at.asc&limit=1000`
  );
  const rows = r.ok ? await r.json() : [];
  for (const row of rows || []) {
    if (row.to_stage === 'contacted') {
      await safeNotify(() => notifyAdmins({
        category: 'admin.commercial.qualified_prospect',
        eventKey: `prospect_qualified:${row.prospect_id}`,
        ctx: {},
      }));
    } else if (row.to_stage === 'rdv') {
      await safeNotify(() => notifyAdmins({
        category: 'admin.commercial.appointment_booked',
        eventKey: `appointment:${row.id}`,
        ctx: {},
      }));
    } else if (row.to_stage === 'quote_sent') {
      await safeNotify(() => notifyAdmins({
        category: 'admin.commercial.quote_sent',
        eventKey: `quote:${row.id}`,
        ctx: {},
      }));
    }
  }
}

async function scanPendingOrders() {
  const staleBefore = new Date(Date.now() - STALE_ORDER_HOURS * 3600 * 1000).toISOString();
  const r = await supabaseAdminRequest(
    `/rest/v1/orders?status=in.(draft,awaiting_payment)&created_at=lt.${staleBefore}&select=id&limit=200`
  );
  const rows = r.ok ? await r.json() : [];
  for (const row of rows || []) {
    await safeNotify(() => notifyAdmins({
      category: 'admin.commercial.pending_sale',
      eventKey: `pending_sale:${row.id}`,
      ctx: {},
    }));
  }
}

async function scanStaleProspects() {
  const staleBefore = new Date(Date.now() - STALE_PROSPECT_HOURS * 3600 * 1000).toISOString();
  const week = isoWeekKey(new Date());
  const r = await supabaseAdminRequest(
    `/rest/v1/prospects?stage=in.(contacted,rdv,quote_sent)&updated_at=lt.${staleBefore}&select=id&limit=200`
  );
  const rows = r.ok ? await r.json() : [];
  for (const row of rows || []) {
    await safeNotify(() => notifyAdmins({
      category: 'admin.commercial.hot_prospect_stale',
      eventKey: `stale:${row.id}:${week}`,
      ctx: { jours: Math.round(STALE_PROSPECT_HOURS) },
    }));
  }
}

exports.handler = async () => {
  const since = await getCursor();
  const now = new Date().toISOString();

  await scanStageTransitions(since, now);
  await scanPendingOrders();
  await scanStaleProspects();

  await setCursor(now);
  return jsonResponse(200, { ok: true, since, now });
};

// netlify/functions/track-funnel-event.js
//
// Journal best-effort des événements du tunnel vsl.html (visite, progression
// vidéo, étapes de la candidature, affichage Calendly, réservation...). Ne
// doit jamais ralentir ni bloquer l'expérience du visiteur : appelée via
// navigator.sendBeacon quand disponible, toujours répond vite, et une
// écriture ratée n'a aucune conséquence côté navigateur.
//
// POST /.netlify/functions/track-funnel-event
//   { id, name, props?, utm?, pageUrl }
//   → { ok: true }  (quasi toujours, y compris en cas d'entrée invalide)

const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { allow } = require('./_lib/rate-limit');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_NAME_RE = /^[a-z0-9_]{1,60}$/i;

function cleanText(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(200, { ok: true });
  }
  // Beaucoup de petits événements par visite : fenêtre plus large que les
  // autres endpoints publics, mais toujours bornée contre un flood.
  if (!(await allow(event, 'gc_funnel_event', 120, 60))) {
    return jsonResponse(200, { ok: true });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(200, { ok: true });
  }

  const applicationId = typeof payload.id === 'string' && UUID_RE.test(payload.id) ? payload.id : null;
  const name = typeof payload.name === 'string' && EVENT_NAME_RE.test(payload.name) ? payload.name : null;
  if (!applicationId || !name) {
    return jsonResponse(200, { ok: true });
  }

  const utm = payload.utm && typeof payload.utm === 'object' ? payload.utm : {};
  let props = null;
  if (payload.props && typeof payload.props === 'object') {
    try {
      props = JSON.parse(JSON.stringify(payload.props).slice(0, 4000));
    } catch (e) {
      props = null;
    }
  }

  const row = {
    application_id: applicationId,
    event_name: name,
    event_props: props,
    utm_source: cleanText(utm.source, 120),
    utm_medium: cleanText(utm.medium, 120),
    utm_campaign: cleanText(utm.campaign, 120),
    utm_content: cleanText(utm.content, 120),
    utm_term: cleanText(utm.term, 120),
    page_url: cleanText(payload.pageUrl, 500),
    user_agent: cleanText(event.headers['user-agent'], 300),
  };

  try {
    const r = await supabaseAdminRequest('/rest/v1/gc_funnel_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[track-funnel-event] Erreur écriture', r.status, detail);
    }
  } catch (e) {
    console.error('[track-funnel-event] NETWORK_ERROR', e);
  }

  return jsonResponse(200, { ok: true });
};

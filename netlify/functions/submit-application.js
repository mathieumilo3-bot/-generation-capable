// netlify/functions/submit-application.js
//
// Enregistre les réponses de la candidature interactive de vsl.html
// (5 questions) avant l'ouverture du calendrier Calendly. Appelée une seule
// fois par le tunnel, juste après la question 5 — et de nouveau si le
// visiteur revient sur l'étape calendrier après un rechargement de page
// (upsert sur l'id généré côté navigateur : jamais de doublon).
//
// Calendly reste l'unique moteur de réservation : cette table ne sert qu'à
// conserver la candidature et permettre, plus tard, un rapprochement manuel
// ou via webhook Calendly avec la réservation effective.
//
// POST /.netlify/functions/submit-application
//   { id, q1, q2[], q3, q4[], q5, videoCompleted, utm:{}, pageUrl }
//   → { ok: true, id }

const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { allow, tooManyRequests } = require('./_lib/rate-limit');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHOICE_RE = /^[a-z0-9_-]{1,80}$/i;

function cleanText(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : null;
}

function cleanChoices(arr, max) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((v) => typeof v === 'string' && CHOICE_RE.test(v))
    .slice(0, 20)
    .map((v) => v.slice(0, max));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }
  if (!(await allow(event, 'gc_application', 20, 60))) {
    return tooManyRequests();
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'INVALID_JSON' });
  }

  const id = typeof payload.id === 'string' && UUID_RE.test(payload.id) ? payload.id : null;
  if (!id) {
    return jsonResponse(400, { error: 'INVALID_ID' });
  }

  const utm = payload.utm && typeof payload.utm === 'object' ? payload.utm : {};

  const row = {
    id,
    q1_situation: cleanChoices([payload.q1].filter(Boolean), 80)[0] || null,
    q2_acquisition: cleanChoices(payload.q2, 80),
    q3_offre: cleanText(payload.q3, 2000),
    q4_objectif: cleanChoices(payload.q4, 80),
    q5_vision: cleanText(payload.q5, 2000),
    video_completed: payload.videoCompleted === true,
    utm_source: cleanText(utm.source, 120),
    utm_medium: cleanText(utm.medium, 120),
    utm_campaign: cleanText(utm.campaign, 120),
    utm_content: cleanText(utm.content, 120),
    utm_term: cleanText(utm.term, 120),
    page_url: cleanText(payload.pageUrl, 500),
    user_agent: cleanText(event.headers['user-agent'], 300),
    updated_at: new Date().toISOString(),
  };

  try {
    const r = await supabaseAdminRequest('/rest/v1/gc_applications?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[submit-application] Erreur écriture', r.status, detail);
      return jsonResponse(200, { ok: false });
    }
  } catch (e) {
    console.error('[submit-application] NETWORK_ERROR', e);
    return jsonResponse(200, { ok: false });
  }

  return jsonResponse(200, { ok: true, id });
};

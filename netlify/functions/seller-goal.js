// netlify/functions/seller-goal.js
//
// "As-tu défini ton objectif aujourd'hui ?" — le vendeur répond en un clic.
// Sert aussi à notify-cron-coach.js pour savoir s'il doit encore relancer
// la question en milieu de matinée.
//
// GET  /.netlify/functions/seller-goal?date=YYYY-MM-DD  (défaut: aujourd'hui)
//   → { goal: { goal_date, target_contacts } | null }
//
// POST /.netlify/functions/seller-goal
//   { date?: 'YYYY-MM-DD', target_contacts?: number }
//   → { ok: true }

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

function todayParis() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { id: userId, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) return jsonResponse(401, { error: authError });

  if (event.httpMethod === 'GET') {
    const qs = event.queryStringParameters || {};
    const date = /^\d{4}-\d{2}-\d{2}$/.test(qs.date || '') ? qs.date : todayParis();
    const r = await supabaseAdminRequest(
      `/rest/v1/seller_daily_goals?seller_user_id=eq.${userId}&goal_date=eq.${date}&select=goal_date,target_contacts`
    );
    const rows = r.ok ? await r.json() : [];
    return jsonResponse(200, { goal: rows && rows[0] ? rows[0] : null });
  }

  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(400, { error: 'INVALID_JSON' });
    }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(payload.date || '') ? payload.date : todayParis();
    const target = Number.isInteger(payload.target_contacts) && payload.target_contacts > 0 ? payload.target_contacts : null;

    const r = await supabaseAdminRequest('/rest/v1/seller_daily_goals?on_conflict=seller_user_id,goal_date', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ seller_user_id: userId, goal_date: date, target_contacts: target }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[seller-goal] Erreur écriture', r.status, detail);
      return jsonResponse(200, { error: 'SUPABASE_WRITE_ERROR' });
    }
    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

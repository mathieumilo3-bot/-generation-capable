// netlify/functions/push-subscribe.js
//
// Enregistre/révoque l'abonnement Push du navigateur pour le compte
// authentifié. Même schéma d'auth que ambassador-data.js/admin-verify.js :
// le client envoie son token de session Supabase, cette fonction le
// vérifie elle-même puis écrit en service_role (jamais l'inverse — voir le
// commentaire d'ambassador-data.js sur pourquoi la RLS seule ne suffit pas).
//
// POST /.netlify/functions/push-subscribe
//   Authorization: Bearer <session_token>
//   { subscription: { endpoint, keys: { p256dh, auth } } }
//   → { ok: true }
//
// DELETE /.netlify/functions/push-subscribe
//   Authorization: Bearer <session_token>
//   { endpoint }
//   → { ok: true }

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { id: userId, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) {
    return jsonResponse(401, { error: authError });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'INVALID_JSON' });
  }

  if (event.httpMethod === 'POST') {
    const sub = payload.subscription;
    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return jsonResponse(400, { error: 'INVALID_SUBSCRIPTION' });
    }
    if (String(sub.endpoint).length > 4000) {
      return jsonResponse(400, { error: 'ENDPOINT_TOO_LONG' });
    }

    const r = await supabaseAdminRequest('/rest/v1/push_subscriptions?on_conflict=endpoint', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth_key: sub.keys.auth,
        user_agent: (event.headers['user-agent'] || '').slice(0, 300),
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[push-subscribe] Erreur écriture', r.status, detail);
      return jsonResponse(200, { error: 'SUPABASE_WRITE_ERROR' });
    }
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod === 'DELETE') {
    const endpoint = payload.endpoint;
    if (!endpoint) return jsonResponse(400, { error: 'MISSING_ENDPOINT' });
    await supabaseAdminRequest(
      `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&user_id=eq.${userId}`,
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ revoked_at: new Date().toISOString() }) }
    );
    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

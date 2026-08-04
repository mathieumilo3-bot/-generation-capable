// netlify/functions/session-guard.js
//
// Un seul appareil connecté à la fois par compte (voir migration 0022).
//
// POURQUOI CÔTÉ SERVEUR
//   Toute vérification faite uniquement dans le navigateur serait
//   contournable en une ligne de console. C'est donc la base qui détient
//   l'appareil autorisé, et cette fonction — qui vérifie d'abord le jeton de
//   session Supabase — est le seul moyen de l'écrire ou de le lire.
//
// RÈGLE : le dernier appareil connecté gagne.
//   'claim' remplace l'appareil enregistré. 'check' dit à un appareil s'il a
//   été remplacé depuis. Un client qui change de téléphone se reconnecte donc
//   normalement, sans jamais avoir besoin du support.
//
// L'identifiant d'appareil est un UUID aléatoire généré par le navigateur et
// conservé en localStorage. Il n'identifie pas la personne et ne contient
// aucune donnée personnelle : il sert seulement à distinguer deux navigateurs.
//
// ROUTES (Authorization: Bearer <session_token> requis)
//   POST { action: 'claim', device_id }  → { ok: true }
//   POST { action: 'check', device_id }  → { displaced: true|false }

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

const DEVICE_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[session-guard] Clés Supabase absentes sur Netlify.');
    // Sans configuration, on n'enferme personne dehors : on laisse passer.
    return jsonResponse(200, { ok: true, displaced: false, error: 'NO_SUPABASE_KEY' });
  }

  // verifySessionToken renvoie l'identifiant du compte : c'est Supabase Auth
  // lui-même qui l'a validé à partir du jeton, il ne vient jamais du client.
  const { id: uid, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) {
    return jsonResponse(401, { error: authError });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return jsonResponse(400, { error: 'Invalid JSON body' }); }

  const deviceId = String(payload.device_id || '').trim();
  if (!DEVICE_ID_RE.test(deviceId)) {
    return jsonResponse(400, { error: 'INVALID_DEVICE_ID' });
  }

  try {
    if (payload.action === 'claim') {
      await supabaseAdminRequest('/rest/v1/active_devices?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          user_id: uid,
          device_id: deviceId,
          user_agent: (event.headers['user-agent'] || '').slice(0, 300) || null,
          claimed_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        }),
      });
      return jsonResponse(200, { ok: true, displaced: false });
    }

    // action 'check'
    const r = await supabaseAdminRequest(
      `/rest/v1/active_devices?user_id=eq.${encodeURIComponent(uid)}&select=device_id`
    );
    if (!r.ok) {
      // Panne de lecture : on ne déconnecte jamais sur un doute.
      return jsonResponse(200, { displaced: false });
    }
    const rows = await r.json();

    // Aucune ligne : premier passage (ou compte antérieur à cette
    // fonctionnalité) → cet appareil devient l'appareil autorisé.
    if (!Array.isArray(rows) || rows.length === 0) {
      await supabaseAdminRequest('/rest/v1/active_devices?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: uid, device_id: deviceId }),
      });
      return jsonResponse(200, { displaced: false });
    }

    const displaced = rows[0].device_id !== deviceId;
    if (!displaced) {
      // Trace de présence, utile pour repérer un partage de compte actif.
      await supabaseAdminRequest(`/rest/v1/active_devices?user_id=eq.${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
      });
    }
    return jsonResponse(200, { displaced });

  } catch (e) {
    console.error('[session-guard] NETWORK_ERROR', e);
    return jsonResponse(200, { displaced: false, error: String(e) });
  }
};

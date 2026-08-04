// netlify/functions/admin-ambassadors.js
//
// Vue administrateur de tous les ambassadeurs : leur lien, leur trafic, leurs
// conversions et ce qu'ils ont gagné. C'est l'écran de rémunération —
// celui qui permet de savoir, ambassadeur par ambassadeur, combien est dû.
//
// Toutes les données viennent de la base (RPC admin_ambassador_leaderboard),
// jamais d'un calcul refait côté navigateur : les montants affichés ici sont
// exactement ceux du registre ambassador_earnings.
//
// ROUTES (Authorization: Bearer <session_token> d'un compte admin requis)
//   GET  ?                          → liste complète
//   GET  ?detail=<ambassador_id>    → détail d'un ambassadeur (ses gains)
//   POST { action: 'set_slug',   ambassador_id, slug }
//   POST { action: 'set_name',   ambassador_id, first_name, last_name }
//   POST { action: 'set_active', ambassador_id, is_active }
//   POST { action: 'mark_paid',  ambassador_id }   → marque les gains dus comme versés

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { isAdminEmail } = require('./_lib/admin-check');

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-ambassadors] Clés Supabase absentes sur Netlify.');
    return jsonResponse(200, { error: 'NO_SUPABASE_KEY' });
  }

  const { email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) {
    return jsonResponse(401, { error: authError, message: 'Session invalide ou expirée.' });
  }
  if (!(await isAdminEmail(email))) {
    return jsonResponse(403, { error: 'NOT_ADMIN' });
  }

  try {
    if (event.httpMethod === 'GET') {
      const detailId = event.queryStringParameters && event.queryStringParameters.detail;
      if (detailId) return await getDetail(detailId);

      const r = await supabaseAdminRequest('/rest/v1/rpc/admin_ambassador_leaderboard', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const rows = await r.json();
      if (!r.ok) {
        console.error('[admin-ambassadors] leaderboard KO', r.status, JSON.stringify(rows));
        return jsonResponse(200, { error: 'READ_ERROR', detail: rows });
      }
      return jsonResponse(200, { ambassadors: rows });
    }

    if (event.httpMethod === 'POST') {
      let payload;
      try { payload = JSON.parse(event.body || '{}'); }
      catch (e) { return jsonResponse(400, { error: 'Invalid JSON body' }); }

      const { action, ambassador_id: ambassadorId } = payload;
      if (!ambassadorId) return jsonResponse(400, { error: 'MISSING_AMBASSADOR_ID' });

      if (action === 'set_slug')   return await setSlug(ambassadorId, payload.slug);
      if (action === 'set_name')   return await setName(ambassadorId, payload.first_name, payload.last_name);
      if (action === 'set_active') return await setActive(ambassadorId, payload.is_active);
      if (action === 'mark_paid')  return await markPaid(ambassadorId);

      return jsonResponse(400, { error: 'UNKNOWN_ACTION' });
    }

    return jsonResponse(405, { error: 'Method not allowed' });

  } catch (e) {
    console.error('[admin-ambassadors] NETWORK_ERROR', e);
    return jsonResponse(200, { error: 'NETWORK_ERROR', message: String(e) });
  }
};

async function getDetail(ambassadorId) {
  const r = await supabaseAdminRequest(
    `/rest/v1/ambassador_earnings?ambassador_id=eq.${encodeURIComponent(ambassadorId)}` +
    `&select=id,kind,amount_cents,status,note,created_at,paid_at,period_month` +
    `&order=created_at.desc&limit=500`
  );
  const rows = await r.json();
  if (!r.ok) return jsonResponse(200, { error: 'READ_ERROR', detail: rows });
  return jsonResponse(200, { earnings: rows });
}

async function setSlug(ambassadorId, rawSlug) {
  const slug = String(rawSlug || '').toLowerCase().trim();
  if (!SLUG_RE.test(slug)) {
    return jsonResponse(200, {
      error: 'INVALID_SLUG',
      message: 'Le lien doit faire 2 à 40 caractères : lettres sans accent, chiffres et tirets uniquement.',
    });
  }

  // Un slug réservé masquerait une vraie page du site (/admin, /index…).
  const resR = await supabaseAdminRequest(`/rest/v1/reserved_slugs?slug=eq.${encodeURIComponent(slug)}&select=slug`);
  if (resR.ok) {
    const reserved = await resR.json();
    if (Array.isArray(reserved) && reserved.length > 0) {
      return jsonResponse(200, { error: 'RESERVED_SLUG', message: 'Ce lien est réservé par le site, choisis-en un autre.' });
    }
  }

  const r = await supabaseAdminRequest(`/rest/v1/ambassadors?id=eq.${encodeURIComponent(ambassadorId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ slug, updated_at: new Date().toISOString() }),
  });
  const data = await r.json();
  if (!r.ok) {
    // 23505 = violation d'unicité : le slug est déjà pris par quelqu'un d'autre.
    const taken = data && (data.code === '23505' || /duplicate key/i.test(JSON.stringify(data)));
    return jsonResponse(200, {
      error: taken ? 'SLUG_TAKEN' : 'WRITE_ERROR',
      message: taken ? 'Ce lien est déjà utilisé par un autre ambassadeur.' : 'Enregistrement impossible.',
      detail: data,
    });
  }
  return jsonResponse(200, { ok: true, slug });
}

async function setName(ambassadorId, firstName, lastName) {
  const r = await supabaseAdminRequest(`/rest/v1/ambassadors?id=eq.${encodeURIComponent(ambassadorId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      first_name: String(firstName || '').trim().slice(0, 80) || null,
      last_name: String(lastName || '').trim().slice(0, 80) || null,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!r.ok) return jsonResponse(200, { error: 'WRITE_ERROR', detail: await r.text() });
  return jsonResponse(200, { ok: true });
}

async function setActive(ambassadorId, isActive) {
  const active = isActive !== false;
  const r = await supabaseAdminRequest(`/rest/v1/ambassadors?id=eq.${encodeURIComponent(ambassadorId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      is_active: active,
      left_at: active ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!r.ok) return jsonResponse(200, { error: 'WRITE_ERROR', detail: await r.text() });
  return jsonResponse(200, { ok: true });
}

// Marque comme versés tous les gains encore dus d'un ambassadeur. Ne touche
// jamais aux lignes déjà 'paid' (pas de double versement) ni aux lignes
// 'cancelled' (ventes remboursées).
async function markPaid(ambassadorId) {
  const r = await supabaseAdminRequest(
    `/rest/v1/ambassador_earnings?ambassador_id=eq.${encodeURIComponent(ambassadorId)}` +
    `&status=in.(pending,available)`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString() }),
    }
  );
  const rows = await r.json();
  if (!r.ok) return jsonResponse(200, { error: 'WRITE_ERROR', detail: rows });
  const total = (Array.isArray(rows) ? rows : []).reduce((s, x) => s + Number(x.amount_cents || 0), 0);
  return jsonResponse(200, { ok: true, marked: Array.isArray(rows) ? rows.length : 0, total_cents: total });
}

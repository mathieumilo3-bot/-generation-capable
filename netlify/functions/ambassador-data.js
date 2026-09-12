// netlify/functions/ambassador-data.js
//
// Pont entre GC Ambassadors OS (ambassadors.html) et la base Supabase.

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { notifyAdmins, safeNotify } = require('./_lib/notifications/send');

const MAX_STATE_BYTES = 200_000;

// État initial d'un NOUVEAU membre : absolument rien n'est considéré comme
// acquis. Le jour 1 démarre ici et la progression est ensuite conservée côté
// serveur, jamais dans un localStorage navigateur.
function defaultState(){
  return {
    active: true,
    name: 'Ambassadeur',
    onboarding: {
      started_at: new Date().toISOString(),
      day: 1
    },
    missionDone: [false, false],
    training: [
      { title: 'Comprendre l\'offre Génération Capable', done: false },
      { title: 'Créer ton premier contenu TikTok', done: false },
      { title: 'Traiter les objections courantes', done: false },
      { title: 'Convertir un prospect en abonné', done: false }
    ],
    chatHistory: [],
    pilot: null
  };
}

const PUBLIC_SITE = 'https://generationcapable.fr';

async function buildReferral(ambassadorId, slug, identity) {
  const link = slug ? `${PUBLIC_SITE}/${slug}` : null;
  const ident = identity || {};
  const base = {
    slug,
    link,
    first_name: ident.first_name || null,
    last_name: ident.last_name || null,
    identity_set: !!(ident.first_name || ident.last_name),
    updated_at: ident.updated_at || null,
  };
  try {
    const r = await supabaseAdminRequest('/rest/v1/rpc/ambassador_dashboard', {
      method: 'POST',
      body: JSON.stringify({ p_ambassador_id: ambassadorId }),
    });
    if (!r.ok) {
      console.error('[ambassador-data] ambassador_dashboard a échoué', r.status);
      return { ...base, stats: null };
    }
    return { ...base, stats: await r.json() };
  } catch (e) {
    console.error('[ambassador-data] buildReferral', e);
    return { ...base, stats: null };
  }
}

const NAME_RE = /^[\p{L}][\p{L}\s'’-]{0,59}$/u;
function cleanName(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }

async function setIdentity(email, rawFirst, rawLast) {
  const firstName = cleanName(rawFirst);
  const lastName  = cleanName(rawLast);
  if (!NAME_RE.test(firstName) || !NAME_RE.test(lastName)) {
    return jsonResponse(200, { error: 'INVALID_NAME', message: 'Renseigne un prénom et un nom valides (lettres, tirets et apostrophes uniquement).' });
  }
  const r = await supabaseAdminRequest(`/rest/v1/ambassadors?email=eq.${encodeURIComponent(email)}&select=id,slug,first_name,last_name`);
  const rows = r.ok ? await r.json() : [];
  const amb = Array.isArray(rows) ? rows[0] : null;
  if (!amb) return jsonResponse(404, { error: 'AMBASSADOR_NOT_FOUND' });

  const identityAlreadySet = !!(amb.first_name || amb.last_name);
  const fields = { first_name: firstName, last_name: lastName, updated_at: new Date().toISOString() };
  let slug = amb.slug;
  if (!identityAlreadySet) {
    try {
      const genR = await supabaseAdminRequest('/rest/v1/rpc/generate_ambassador_slug', {
        method: 'POST', body: JSON.stringify({ p_base: `${firstName} ${lastName}`, p_exclude_id: amb.id }),
      });
      if (genR.ok) {
        const generated = await genR.json();
        if (generated) { slug = generated; fields.slug = generated; }
      } else console.error('[ambassador-data] generate_ambassador_slug a échoué', genR.status);
    } catch (e) { console.error('[ambassador-data] setIdentity / slug', e); }
  }
  const upR = await supabaseAdminRequest(`/rest/v1/ambassadors?id=eq.${amb.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fields),
  });
  if (!upR.ok) {
    const detail = await upR.text();
    console.error('[ambassador-data] Écriture identité échouée', upR.status, detail);
    return jsonResponse(200, { error: 'WRITE_ERROR', message: 'Enregistrement impossible, réessaie.' });
  }
  return jsonResponse(200, { ok: true, referral: await buildReferral(amb.id, slug) });
}

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) return jsonResponse(200, { error: 'NO_SUPABASE_KEY', message: 'Clé Supabase non configurée sur Netlify.' });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonResponse(200, { error: 'NO_SERVICE_ROLE_KEY', message: 'Clé Supabase privilégiée non configurée sur Netlify.' });

  const { email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) return jsonResponse(401, { error: authError, message: 'Session invalide ou expirée — reconnecte-toi.' });

  try {
    if (event.httpMethod === 'GET') {
      const r = await supabaseAdminRequest(`/rest/v1/ambassadors?email=eq.${encodeURIComponent(email)}&select=id,state,slug,first_name,last_name,updated_at,created_at`);
      const rows = await r.json();
      if (!r.ok) return jsonResponse(200, { error: 'SUPABASE_READ_ERROR', detail: rows });

      if (rows.length > 0) {
        const amb = rows[0];
        const state = amb.state && typeof amb.state === 'object' ? amb.state : defaultState();
        // Compatibilité : un ancien état peut contenir le premier module
        // marqué done à cause de l'ancien défaut. On ne touche PAS aux
        // comptes déjà existants automatiquement ; seuls les nouveaux
        // comptes commencent désormais à 0/0.
        if (!state.onboarding) state.onboarding = { started_at: amb.created_at || new Date().toISOString(), day: 1 };
        return jsonResponse(200, { state, referral: await buildReferral(amb.id, amb.slug, amb) });
      }

      const initial = defaultState();
      const createR = await supabaseAdminRequest('/rest/v1/ambassadors', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ email, state: initial })
      });
      const created = await createR.json();
      if (!createR.ok) return jsonResponse(200, { error: 'SUPABASE_CREATE_ERROR', detail: created });
      await safeNotify(() => notifyAdmins({ category: 'admin.business.new_ambassador', eventKey: `new_ambassador:${email}`, ctx: { email } }));
      const newRow = Array.isArray(created) ? created[0] : created;
      return jsonResponse(200, { state: initial, referral: newRow && newRow.id ? await buildReferral(newRow.id, null, newRow) : null });
    }

    if (event.httpMethod === 'POST') {
      let payload;
      try { payload = JSON.parse(event.body || '{}'); } catch (e) { return jsonResponse(400, { error: 'Invalid JSON body' }); }
      if (payload.action === 'set_identity') return await setIdentity(email, payload.first_name, payload.last_name);
      const { state } = payload;
      if (!state) return jsonResponse(400, { error: 'Missing state' });
      if (JSON.stringify(state).length > MAX_STATE_BYTES) return jsonResponse(413, { error: 'STATE_TOO_LARGE' });
      const r = await supabaseAdminRequest(`/rest/v1/ambassadors?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ state, updated_at: new Date().toISOString() })
      });
      if (!r.ok) return jsonResponse(200, { error: 'SUPABASE_WRITE_ERROR', detail: await r.text() });
      return jsonResponse(200, { ok: true });
    }
    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (e) {
    console.error('[ambassador-data] NETWORK_ERROR', e);
    return jsonResponse(200, { error: 'NETWORK_ERROR', message: String(e) });
  }
};
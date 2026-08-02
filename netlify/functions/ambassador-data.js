// netlify/functions/ambassador-data.js
//
// Pont entre GC Ambassadors OS (ambassadors.html) et la base Supabase.
//
// AUTH (2026-07-27) : ambassadors.html envoie un vrai token de session
// Supabase (Authorization: Bearer <access_token>, obtenu via le magic link),
// jamais un email en clair. Cette fonction vérifie ce token auprès de
// Supabase Auth et utilise l'email qu'il contient comme identité.
//
// FIX (audit production) : cette fonction appelait ensuite l'API REST
// Supabase avec la clé ANON (publique, visible dans ambassadors.html). Pour
// que ça fonctionne, la RLS de la table "ambassadors" devait forcément
// autoriser le rôle "anon" à lire/écrire — ce qui voulait dire que N'IMPORTE
// QUI pouvait appeler l'API Supabase directement avec cette même clé et
// lire/écrire les données de n'importe quel ambassadeur en devinant son
// email, en contournant complètement la vérification de token ci-dessous.
// Fix : la fonction utilise maintenant SUPABASE_SERVICE_ROLE_KEY (qui
// contourne la RLS) pour l'accès aux données, après avoir vérifié le token
// elle-même. La RLS sur "ambassadors" n'accorde plus aucun accès à
// anon/authenticated (voir supabase/migrations/0001_subscribers_roles_and_rls.sql) :
// cette fonction redevient la seule porte d'entrée possible.
//
// ROUTES
//   GET  /.netlify/functions/ambassador-data
//        (Authorization: Bearer <session_token> requis)
//        → renvoie l'état de l'ambassadeur authentifié (le crée avec l'état
//          par défaut si c'est sa première connexion)
//   POST /.netlify/functions/ambassador-data  { state }
//        (Authorization: Bearer <session_token> requis)
//        → écrit l'état de l'ambassadeur authentifié

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { notifyAdmins, safeNotify } = require('./_lib/notifications/send');

const MAX_STATE_BYTES = 200_000; // large marge au-dessus d'un usage normal, évite l'abus

function defaultState(){
  return {
    active: true,
    name: 'Ambassadeur',
    code: 'GC-AMB' + Math.floor(100 + Math.random() * 900),
    missionDone: [false, false],
    revenue: { today: 0, week: 0, month: 0, total: 0, activeSubs: 0, history: [] },
    training: [
      { title: 'Comprendre l\'offre Génération Capable', done: true },
      { title: 'Créer ton premier contenu TikTok', done: false },
      { title: 'Traiter les objections courantes', done: false },
      { title: 'Convertir un prospect en abonné', done: false }
    ],
    chatHistory: []
  };
}

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('[ambassador-data] SUPABASE_ANON_KEY absente sur Netlify.');
    return jsonResponse(200, { error: 'NO_SUPABASE_KEY', message: "Clé Supabase non configurée sur Netlify (SUPABASE_ANON_KEY)." });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[ambassador-data] SUPABASE_SERVICE_ROLE_KEY absente sur Netlify.');
    return jsonResponse(200, { error: 'NO_SERVICE_ROLE_KEY', message: "Clé Supabase privilégiée non configurée sur Netlify (SUPABASE_SERVICE_ROLE_KEY)." });
  }

  const { email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) {
    console.error('[ambassador-data] Auth échouée:', authError);
    return jsonResponse(401, { error: authError, message: 'Session invalide ou expirée — reconnecte-toi.' });
  }

  try {
    if (event.httpMethod === 'GET') {
      const r = await supabaseAdminRequest(
        `/rest/v1/ambassadors?email=eq.${encodeURIComponent(email)}&select=state`
      );
      const rows = await r.json();
      if (!r.ok) {
        console.error('[ambassador-data] Erreur lecture Supabase', r.status, JSON.stringify(rows));
        return jsonResponse(200, { error: 'SUPABASE_READ_ERROR', detail: rows });
      }

      if (rows.length > 0) {
        return jsonResponse(200, { state: rows[0].state });
      }

      // Ambassadeur inconnu → première connexion, on le crée avec l'état par défaut.
      const initial = defaultState();
      const createR = await supabaseAdminRequest('/rest/v1/ambassadors', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ email, state: initial })
      });
      const created = await createR.json();
      if (!createR.ok) {
        console.error('[ambassador-data] Erreur création Supabase', createR.status, JSON.stringify(created));
        return jsonResponse(200, { error: 'SUPABASE_CREATE_ERROR', detail: created });
      }
      await safeNotify(() => notifyAdmins({
        category: 'admin.business.new_ambassador',
        eventKey: `new_ambassador:${email}`,
        ctx: { email },
      }));
      return jsonResponse(200, { state: initial });
    }

    if (event.httpMethod === 'POST') {
      let payload;
      try {
        payload = JSON.parse(event.body || '{}');
      } catch (e) {
        return jsonResponse(400, { error: 'Invalid JSON body' });
      }
      const { state } = payload;
      if (!state) return jsonResponse(400, { error: 'Missing state' });
      if (JSON.stringify(state).length > MAX_STATE_BYTES) {
        return jsonResponse(413, { error: 'STATE_TOO_LARGE' });
      }

      const r = await supabaseAdminRequest(
        `/rest/v1/ambassadors?email=eq.${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ state, updated_at: new Date().toISOString() })
        }
      );
      if (!r.ok) {
        const detail = await r.text();
        console.error('[ambassador-data] Erreur écriture Supabase', r.status, detail);
        return jsonResponse(200, { error: 'SUPABASE_WRITE_ERROR', detail });
      }
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: 'Method not allowed' });

  } catch (e) {
    console.error('[ambassador-data] NETWORK_ERROR', e);
    return jsonResponse(200, { error: 'NETWORK_ERROR', message: String(e) });
  }
};

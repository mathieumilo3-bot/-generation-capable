// netlify/functions/ambassador-data.js
//
// Pont entre GC Ambassadors OS (ambassadors.html) et la base Supabase.
//
// AUTH (2026-07-27, fix) : ambassadors.html envoie un vrai token de session
// Supabase (Authorization: Bearer <access_token>, obtenu via le magic link),
// pas un email en clair. Cette fonction vérifie ce token auprès de Supabase
// Auth et utilise l'email qu'il contient comme identité — jamais un email
// fourni tel quel par le client. Avant ce fix, le GET exigeait un ?email=
// que le front n'envoie plus depuis le passage au vrai auth (23/07), d'où un
// échec 100% du chargement juste après la connexion par magic link.
// Ça ferme aussi le trou décrit dans le Pack Légal V1 (accès par email seul,
// sans session vérifiée) : un utilisateur ne peut plus lire/écrire les
// données d'un autre ambassadeur en devinant son adresse.
//
// ROUTES
//   GET  /.netlify/functions/ambassador-data
//        (Authorization: Bearer <session_token> requis)
//        → renvoie l'état de l'ambassadeur authentifié (le crée avec l'état
//          par défaut si c'est sa première connexion)
//   POST /.netlify/functions/ambassador-data  { state }
//        (Authorization: Bearer <session_token> requis)
//        → écrit l'état de l'ambassadeur authentifié

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fkhfahmzxsahrstxntjs.supabase.co';

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

// Vérifie le token de session envoyé par le front auprès de Supabase Auth et
// retourne l'email vérifié. Ne fait JAMAIS confiance à un email fourni par
// le client lui-même.
async function getVerifiedEmail(event, anonKey){
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) return { error: 'MISSING_TOKEN' };
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'MISSING_TOKEN' };

  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': anonKey, 'Authorization': `Bearer ${token}` }
  });
  if (!r.ok) return { error: 'INVALID_TOKEN' };
  const user = await r.json();
  if (!user?.email) return { error: 'INVALID_TOKEN' };
  return { email: user.email.toLowerCase() };
}

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('[ambassador-data] SUPABASE_ANON_KEY absente sur Netlify.');
    return json(200, { error: 'NO_SUPABASE_KEY', message: "Clé Supabase non configurée sur Netlify (SUPABASE_ANON_KEY)." });
  }

  const { email, error: authError } = await getVerifiedEmail(event, anonKey);
  if (authError) {
    console.error('[ambassador-data] Auth échouée:', authError);
    return json(401, { error: authError, message: 'Session invalide ou expirée — reconnecte-toi.' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`
  };

  try {
    if (event.httpMethod === 'GET') {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/ambassadors?email=eq.${encodeURIComponent(email)}&select=state`,
        { headers }
      );
      const rows = await r.json();
      if (!r.ok) {
        console.error('[ambassador-data] Erreur lecture Supabase', r.status, JSON.stringify(rows));
        return json(200, { error: 'SUPABASE_READ_ERROR', detail: rows });
      }

      if (rows.length > 0) {
        return json(200, { state: rows[0].state });
      }

      // Ambassadeur inconnu → première connexion, on le crée avec l'état par défaut.
      const initial = defaultState();
      const createR = await fetch(`${SUPABASE_URL}/rest/v1/ambassadors`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ email, state: initial })
      });
      const created = await createR.json();
      if (!createR.ok) {
        console.error('[ambassador-data] Erreur création Supabase', createR.status, JSON.stringify(created));
        return json(200, { error: 'SUPABASE_CREATE_ERROR', detail: created });
      }
      return json(200, { state: initial });
    }

    if (event.httpMethod === 'POST') {
      let payload;
      try {
        payload = JSON.parse(event.body || '{}');
      } catch (e) {
        return json(400, { error: 'Invalid JSON body' });
      }
      const { state } = payload;
      if (!state) return json(400, { error: 'Missing state' });

      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/ambassadors?email=eq.${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ state, updated_at: new Date().toISOString() })
        }
      );
      if (!r.ok) {
        const detail = await r.text();
        console.error('[ambassador-data] Erreur écriture Supabase', r.status, detail);
        return json(200, { error: 'SUPABASE_WRITE_ERROR', detail });
      }
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });

  } catch (e) {
    console.error('[ambassador-data] NETWORK_ERROR', e);
    return json(200, { error: 'NETWORK_ERROR', message: String(e) });
  }
};

function json(statusCode, data) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

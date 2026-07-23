// netlify/functions/ambassador-data.js
//
// Pont entre GC Ambassadors OS (ambassadors.html) et la base Supabase.
// Le navigateur ne parle JAMAIS directement à Supabase — uniquement à cette
// fonction, qui elle seule détient la clé Supabase (variable d'environnement
// Netlify SUPABASE_ANON_KEY, à ajouter comme ANTHROPIC_API_KEY/OPENAI_API_KEY
// l'ont été précédemment).
//
// Ça résout le problème "données coincées sur un seul téléphone" (localStorage)
// : chaque ambassadeur est identifié par son email, sa progression/ses revenus
// vivent maintenant en base, accessibles depuis n'importe quel appareil.
//
// ROUTES
//   GET  /.netlify/functions/ambassador-data?email=xxx
//        → renvoie l'état de l'ambassadeur (le crée avec l'état par défaut
//          s'il n'existe pas encore)
//   POST /.netlify/functions/ambassador-data  { email, state }
//        → écrit l'état (upsert)
//
// SÉCURITÉ V1 (honnête, à lire) : il n'y a pas encore de vraie authentification
// (pas de mot de passe / session vérifiée) — n'importe qui connaissant un email
// pourrait en théorie lire/écrire l'état associé. Acceptable pour un pilote à
// quelques ambassadeurs de confiance. À durcir avant un lancement ouvert : vraie
// auth Supabase (magic link ou mot de passe) + policies RLS par utilisateur au
// lieu de la policy permissive posée en V1.

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

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('[ambassador-data] SUPABASE_ANON_KEY absente sur Netlify.');
    return json(200, { error: 'NO_SUPABASE_KEY', message: "Clé Supabase non configurée sur Netlify (SUPABASE_ANON_KEY)." });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`
  };

  try {
    if (event.httpMethod === 'GET') {
      const email = (event.queryStringParameters || {}).email;
      if (!email) return json(400, { error: 'Missing email' });

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

      // Ambassadeur inconnu → on le crée avec l'état par défaut.
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
      const { email, state } = payload;
      if (!email || !state) return json(400, { error: 'Missing email or state' });

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

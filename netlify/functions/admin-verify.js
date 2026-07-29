// netlify/functions/admin-verify.js
//
// Vérification serveur du rôle admin — remplace l'ancien mot de passe
// ('GC2025') qui était embarqué en clair dans index.html et donc lisible par
// n'importe qui via "Afficher le code source". Aucune sécurité ne doit
// reposer sur du JavaScript côté navigateur : cette fonction est la seule
// autorité sur qui est admin.
//
// GET /.netlify/functions/admin-verify
//   (Authorization: Bearer <session_token> requis)
//   → { authorized: true }  si subscribers.role = 'admin' pour ce compte
//   → 403 { authorized: false } sinon
//   → 401 si le token est absent/invalide/expiré
//
// Le front-end doit traiter TOUTE réponse autre que { authorized: true }
// comme un refus d'accès — jamais de fallback "autorisé par défaut".

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[admin-verify] Variables Supabase manquantes sur Netlify.');
    return jsonResponse(500, { authorized: false, error: 'SERVER_NOT_CONFIGURED' });
  }

  // On vérifie par email (claim vérifié par Supabase Auth), pas par user_id :
  // les lignes "subscribers" créées après un paiement Stripe ne connaissent
  // que l'email du payeur (voir migration SQL) — filtrer par user_id ne
  // trouverait jamais ces lignes.
  const { email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) {
    return jsonResponse(401, { authorized: false, error: authError });
  }

  try {
    const r = await supabaseAdminRequest(
      `/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}&select=role`
    );
    const rows = await r.json();
    if (!r.ok) {
      console.error('[admin-verify] Erreur lecture Supabase', r.status, JSON.stringify(rows));
      return jsonResponse(500, { authorized: false, error: 'SUPABASE_READ_ERROR' });
    }

    const isAdmin = rows.length > 0 && rows[0].role === 'admin';
    if (!isAdmin) {
      return jsonResponse(403, { authorized: false });
    }
    return jsonResponse(200, { authorized: true });

  } catch (e) {
    console.error('[admin-verify] NETWORK_ERROR', e);
    return jsonResponse(500, { authorized: false, error: 'NETWORK_ERROR' });
  }
};

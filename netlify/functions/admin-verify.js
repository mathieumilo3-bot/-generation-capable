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
//   → { authorized: true }  si l'email de ce compte figure dans public.admins
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

  // Le rôle admin est décidé par la table "admins" (email -> compte fondateur
  // / staff), distincte de "subscribers" (qui ne porte que l'abonnement
  // payant et est indexée sur user_id). "admins" a RLS activée sans aucune
  // policy pour anon/authenticated : seule une requête service_role (celle-ci)
  // peut la lire.
  const { email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) {
    return jsonResponse(401, { authorized: false, error: authError });
  }

  try {
    const r = await supabaseAdminRequest(
      `/rest/v1/admins?email=eq.${encodeURIComponent(email)}&select=email`
    );
    const rows = await r.json();
    if (!r.ok) {
      console.error('[admin-verify] Erreur lecture Supabase', r.status, JSON.stringify(rows));
      return jsonResponse(500, { authorized: false, error: 'SUPABASE_READ_ERROR' });
    }

    const isAdmin = Array.isArray(rows) && rows.length > 0;
    if (!isAdmin) {
      return jsonResponse(403, { authorized: false });
    }
    return jsonResponse(200, { authorized: true });

  } catch (e) {
    console.error('[admin-verify] NETWORK_ERROR', e);
    return jsonResponse(500, { authorized: false, error: 'NETWORK_ERROR' });
  }
};

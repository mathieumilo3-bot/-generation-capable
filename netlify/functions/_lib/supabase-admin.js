// netlify/functions/_lib/supabase-admin.js
//
// Helpers Supabase partagés par les Netlify Functions qui doivent (1) vérifier
// l'identité d'un appelant à partir de son token de session, et (2) lire/écrire
// en base avec un accès privilégié (service_role, qui contourne la RLS).
//
// La service_role key ne doit JAMAIS être envoyée au navigateur — elle
// n'existe que dans les variables d'environnement Netlify et n'est utilisée
// qu'ici, côté serveur.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fkhfahmzxsahrstxntjs.supabase.co';

// Vérifie un token de session Supabase (Authorization: Bearer <token>) et
// retourne l'identité vérifiée par Supabase Auth lui-même — jamais un email
// ou un user_id fourni tel quel par le client.
async function verifySessionToken(event, anonKey) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) return { error: 'MISSING_TOKEN' };
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'MISSING_TOKEN' };

  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return { error: 'INVALID_TOKEN' };
  const user = await r.json();
  if (!user?.id || !user?.email) return { error: 'INVALID_TOKEN' };
  return { id: user.id, email: user.email.toLowerCase() };
}

// Appel REST Supabase authentifié en service_role (contourne la RLS). Réservé
// aux opérations que la fonction appelante a déjà autorisées elle-même
// (vérification de token, vérification de rôle, événement Stripe signé...).
async function supabaseAdminRequest(path, options = {}) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY absente des variables d\'environnement Netlify');
  }
  const r = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(options.headers || {})
    }
  });
  return r;
}

function jsonResponse(statusCode, data) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

module.exports = { SUPABASE_URL, verifySessionToken, supabaseAdminRequest, jsonResponse };

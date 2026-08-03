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

// ── Résolution / création du compte Supabase Auth à partir d'un email ──
//
// Stripe ne connaît que l'email du payeur, jamais l'id Supabase Auth — et le
// schéma de production actuel (table "subscribers") est indexé sur user_id,
// pas sur email. Ces helpers, utilisés uniquement côté serveur (service_role),
// retrouvent (ou créent) le compte Auth correspondant à un paiement confirmé.

// Retrouve un utilisateur Supabase Auth par email exact, ou null si aucun.
async function getAuthUserByEmail(email) {
  const r = await supabaseAdminRequest(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
  if (!r.ok) return null;
  const data = await r.json();
  const users = Array.isArray(data?.users) ? data.users : [];
  return users.find(u => (u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

// Crée un compte Auth déjà confirmé (paiement = preuve suffisante) pour un
// email qui n'a, pour une raison ou une autre, pas de compte au moment où le
// paiement est confirmé (ex: création de compte échouée avant Stripe). Aucun
// mot de passe n'est fixé : l'utilisateur en choisit un via "mot de passe
// oublié" à sa prochaine connexion.
async function createAuthUser(email) {
  const r = await supabaseAdminRequest('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, email_confirm: true })
  });
  const data = await r.json();
  if (!r.ok) throw new Error('CREATE_USER_FAILED: ' + JSON.stringify(data));
  return data;
}

// Force la confirmation de l'email : le paiement Stripe est une preuve
// d'identité au moins aussi forte qu'un clic sur un lien de confirmation, et
// la connexion immédiate après paiement ne doit jamais être bloquée par un
// compte resté "non confirmé" (ex: e-mail de confirmation jamais ouvert).
async function confirmUserEmail(userId) {
  await supabaseAdminRequest(`/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ email_confirm: true })
  });
}

// Retrouve OU crée le compte Auth pour cet email, et s'assure qu'il est
// confirmé. Utilisé par verify-checkout-session.js et stripe-webhook.js pour
// que l'activation post-paiement ne dépende jamais de l'état antérieur du
// compte (créé avant paiement, jamais créé, ou créé mais non confirmé).
async function ensureAuthUserForEmail(email) {
  let user = await getAuthUserByEmail(email);
  if (!user) {
    user = await createAuthUser(email);
  } else if (!user.email_confirmed_at) {
    await confirmUserEmail(user.id);
  }
  return user;
}

// Génère un jeton "magic link" à usage unique permettant au navigateur du
// payeur d'établir une VRAIE session Supabase Auth immédiatement après
// confirmation du paiement (supa.auth.verifyOtp côté client), sans ressaisie
// de mot de passe. Retourne null si la génération échoue (le paiement reste
// activé côté base — seule la connexion auto est dégradée, l'utilisateur
// peut toujours se connecter avec son mot de passe).
async function generateMagicLinkOtp(email) {
  try {
    const r = await supabaseAdminRequest('/auth/v1/admin/generate_link', {
      method: 'POST',
      body: JSON.stringify({ type: 'magiclink', email })
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.properties?.email_otp || null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  SUPABASE_URL,
  verifySessionToken,
  supabaseAdminRequest,
  jsonResponse,
  getAuthUserByEmail,
  createAuthUser,
  confirmUserEmail,
  ensureAuthUserForEmail,
  generateMagicLinkOtp,
};

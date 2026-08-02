// netlify/functions/vapid-public-key.js
//
// La clé publique VAPID est, par construction, publique (c'est elle que le
// navigateur utilise pour PushManager.subscribe({applicationServerKey})) —
// aucune authentification requise. Seule la clé PRIVÉE (VAPID_PRIVATE_KEY)
// reste strictement côté serveur (voir _lib/notifications/webpush.js).
//
// GET /.netlify/functions/vapid-public-key → { publicKey }

const { jsonResponse } = require('./_lib/supabase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return jsonResponse(200, { publicKey: null, error: 'NOT_CONFIGURED' });
  }
  return jsonResponse(200, { publicKey });
};

// netlify/functions/_lib/notifications/webpush.js
//
// Fine couche au-dessus du paquet "web-push" (chiffrement RFC 8291 +
// signature VAPID) — seule dépendance npm de tout le dépôt Netlify
// Functions (voir package.json à la racine). Le reste des fonctions évite
// délibérément les SDK (voir stripe-webhook.js), mais implémenter à la main
// ECDH + HKDF + AES-128-GCM pour chaque navigateur cible sans suite de
// tests contre de vrais services Push serait un risque bien plus grand
// qu'une dépendance mature et largement auditée (>2M téléchargements/semaine).

const webpush = require('web-push');

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contact@generationcapable.fr';
  if (!publicKey || !privateKey) {
    console.error('[webpush] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes — envoi Push désactivé.');
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

// Envoie une notification à un abonnement précis. Renvoie
// { ok: true } ou { ok: false, expired: boolean, error }.
// expired=true (404/410 renvoyé par le service Push) signifie que
// l'abonnement n'existe plus côté navigateur — l'appelant doit le révoquer
// pour ne pas réessayer indéfiniment un endpoint mort.
async function sendToSubscription(subscription, payload) {
  if (!ensureConfigured()) return { ok: false, expired: false, error: 'VAPID_NOT_CONFIGURED' };
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (e) {
    const statusCode = e && e.statusCode;
    const expired = statusCode === 404 || statusCode === 410;
    if (!expired) {
      console.error('[webpush] Échec envoi', statusCode, e && e.body);
    }
    return { ok: false, expired, error: String(statusCode || e) };
  }
}

module.exports = { sendToSubscription, ensureConfigured };

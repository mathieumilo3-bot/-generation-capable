// netlify/functions/_lib/notifications/email.js
//
// Envoi d'email via l'API REST Resend (pas de SDK, même logique que
// _lib/stripe-rest.js pour Stripe : un simple appel fetch signé par la clé
// API, zéro dépendance). Utilisé uniquement pour la séquence "prospect" —
// un visiteur qui a laissé son email mais n'a pas de compte ne peut pas
// détenir d'abonnement Push (voir templates.js pour le choix du canal).

const crypto = require('crypto');

// Lien de désinscription signé (RGPD/CAN-SPAM : tout email marketing vers un
// non-client doit permettre de s'y opposer en un clic, sans compte ni
// connexion). Signature HMAC plutôt qu'un id nu pour qu'on ne puisse pas
// désinscrire le lead de quelqu'un d'autre en devinant/énumérant des uuid.
function unsubscribeToken(leadId) {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.VAPID_PRIVATE_KEY || 'dev-secret-change-me';
  const sig = crypto.createHmac('sha256', secret).update(leadId).digest('hex').slice(0, 32);
  return `${leadId}.${sig}`;
}

function verifyUnsubscribeToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [leadId, sig] = token.split('.');
  if (!leadId || !sig) return null;
  const expected = unsubscribeToken(leadId).split('.')[1];
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  return leadId;
}

function unsubscribeFooter(leadId) {
  const siteUrl = process.env.SITE_URL || 'https://generationcapable.fr';
  const url = `${siteUrl}/.netlify/functions/unsubscribe-lead?token=${encodeURIComponent(unsubscribeToken(leadId))}`;
  return `<p style="margin-top:24px;font-size:12px;color:#888">Tu ne souhaites plus recevoir ces emails ? <a href="${url}">Se désinscrire</a>.</p>`;
}

async function sendLeadEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'Génération Capable <notifications@generationcapable.fr>';
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY absente — email non envoyé:', subject);
    return { ok: false, error: 'RESEND_NOT_CONFIGURED' };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[email] Échec envoi Resend', r.status, detail);
      return { ok: false, error: `HTTP_${r.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] NETWORK_ERROR', e);
    return { ok: false, error: 'NETWORK_ERROR' };
  }
}

module.exports = { sendLeadEmail, unsubscribeToken, verifyUnsubscribeToken, unsubscribeFooter };

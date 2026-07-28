// netlify/functions/create-checkout-session.js
//
// Crée une session Stripe Checkout côté serveur. Remplace les anciens liens
// Stripe (buy.stripe.com) codés en dur et identiques pour toutes les offres,
// et remplace surtout l'ancien "honor system" (confirmPaymentReturn() côté
// front activait l'accès sur un simple clic, sans aucune vérification).
//
// Le client n'envoie qu'une clé symbolique d'offre ("eco_monthly",
// "academie_97", ...) — jamais un Price ID ou un montant. Le mapping vers le
// vrai Price ID Stripe est fait ici, côté serveur, à partir d'une
// configuration fixe (_lib/stripe-offers.js). Impossible pour un client de
// obtenir un prix ou un produit différent de celui prévu en modifiant la
// requête.
//
// POST /.netlify/functions/create-checkout-session
//   body: { offer: 'eco_monthly'|'eco_semester'|'academie_97'|'academie_247', email, name? }
//   → { url: 'https://checkout.stripe.com/...' }  (à rediriger, même onglet)

const { getOffer } = require('./_lib/stripe-offers');
const { stripeRequest } = require('./_lib/stripe-rest');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// N'utilise l'Origin/Host de la requête que s'il correspond au domaine de
// prod ou à un déploiement Netlify (prévisualisation/branche) connu — sinon
// on retombe sur le domaine de prod. Évite qu'un appel forgé (Host modifié)
// ne fasse pointer success_url/cancel_url vers un domaine arbitraire.
function safeOrigin(event) {
  const candidate = event.headers.origin || `https://${event.headers.host || ''}`;
  try {
    const u = new URL(candidate);
    if (u.hostname === 'generationcapable.fr' || u.hostname.endsWith('.netlify.app') || u.hostname === 'localhost') {
      return u.origin;
    }
  } catch (e) { /* URL invalide → fallback ci-dessous */ }
  return 'https://generationcapable.fr';
}

function json(statusCode, data) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { offer: offerKey, email } = payload;
  if (!offerKey || !email || !EMAIL_RE.test(email)) {
    return json(400, { error: 'Missing or invalid offer/email' });
  }

  const offer = getOffer(offerKey);
  if (!offer) {
    console.error('[create-checkout-session] Offre inconnue ou Price ID non configuré:', offerKey);
    return json(400, { error: 'UNKNOWN_OFFER', message: 'Offre inconnue ou pas encore configurée côté serveur.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[create-checkout-session] STRIPE_SECRET_KEY absente sur Netlify.');
    return json(200, { error: 'NO_STRIPE_KEY', message: 'Paiement indisponible pour le moment — réessaie plus tard.' });
  }

  const origin = safeOrigin(event);

  try {
    const { ok, status, data } = await stripeRequest('POST', '/checkout/sessions', {
      mode: offer.mode,
      line_items: [{ price: offer.priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: email,
      success_url: `${origin}/?checkout=success&offer=${offer.key}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled&offer=${offer.key}`,
      metadata: { offer: offer.key },
      allow_promotion_codes: true,
    });

    if (!ok) {
      console.error('[create-checkout-session] Erreur Stripe', status, JSON.stringify(data));
      return json(200, { error: 'STRIPE_ERROR', message: data?.error?.message || 'Erreur Stripe' });
    }

    return json(200, { url: data.url });

  } catch (e) {
    console.error('[create-checkout-session] NETWORK_ERROR', e);
    return json(200, { error: 'NETWORK_ERROR', message: String(e) });
  }
};

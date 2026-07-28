// netlify/functions/verify-checkout-session.js
//
// Confirmation immédiate après retour de Stripe Checkout. Le flux "lettre
// d'engagement" (Module 01 / Académie) ne crée pas de compte Supabase Auth —
// il n'y a donc pas de session utilisateur à vérifier au retour. On s'appuie
// à la place sur le session_id Stripe : un identifiant long et imprévisible
// que seul le navigateur du payeur reçoit via la redirection success_url.
// Impossible à deviner/forcer par un tiers — c'est la même garantie de
// sécurité qu'un token à usage unique.
//
// Cette fonction NE FAIT PAS confiance à un simple "j'ai payé" côté client
// (c'était l'ancien comportement de confirmPaymentReturn()) : elle interroge
// Stripe lui-même pour confirmer que le paiement a réellement abouti avant
// d'activer quoi que ce soit.
//
// Le webhook Stripe (stripe-webhook.js) reste la source de vérité pour tout
// ce qui arrive APRÈS ce premier instant (renouvellement, échec de paiement,
// annulation, remboursement) — cette fonction ne couvre que le retour
// immédiat post-paiement pour débloquer l'accès sans attendre.
//
// GET /.netlify/functions/verify-checkout-session?session_id=cs_...
//   → { activated: true, email }   si le paiement est confirmé
//   → { activated: false, ... }    sinon (jamais d'activation par défaut)

const { stripeRequest } = require('./_lib/stripe-rest');
const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId || !/^cs_/.test(sessionId)) {
    return jsonResponse(400, { activated: false, error: 'MISSING_SESSION_ID' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[verify-checkout-session] STRIPE_SECRET_KEY absente sur Netlify.');
    return jsonResponse(200, { activated: false, error: 'NO_STRIPE_KEY' });
  }

  try {
    const { ok, status, data: session } = await stripeRequest('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (!ok) {
      console.error('[verify-checkout-session] Erreur Stripe', status, JSON.stringify(session));
      return jsonResponse(200, { activated: false, error: 'STRIPE_ERROR' });
    }

    // "complete" est le statut documenté par Stripe pour un Checkout qui a
    // réellement abouti (paiement unique confirmé, ou abonnement créé).
    if (session.status !== 'complete') {
      return jsonResponse(200, { activated: false, status: session.status });
    }

    const email = (session.customer_details?.email || session.customer_email || '').toLowerCase();
    const offer = session.metadata?.offer || null;
    if (!email) {
      console.error('[verify-checkout-session] Session complète sans email:', sessionId);
      return jsonResponse(200, { activated: false, error: 'NO_EMAIL_ON_SESSION' });
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await activateSubscriber({ email, offer, session });
    } else {
      console.error('[verify-checkout-session] SUPABASE_SERVICE_ROLE_KEY absente — activation Stripe confirmée mais pas persistée en base.');
    }

    return jsonResponse(200, { activated: true, email, offer });

  } catch (e) {
    console.error('[verify-checkout-session] NETWORK_ERROR', e);
    return jsonResponse(200, { activated: false, error: 'NETWORK_ERROR' });
  }
};

async function activateSubscriber({ email, offer, session }) {
  // Upsert sur l'email (contrainte unique posée par la migration SQL).
  await supabaseAdminRequest('/rest/v1/subscribers?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      email,
      is_active: true,
      plan: offer,
      stripe_customer_id: session.customer || null,
      stripe_subscription_id: session.subscription || null,
      updated_at: new Date().toISOString(),
    })
  });

  // Trace d'audit — idempotent : un même session_id ne crée qu'une ligne
  // (stripe_event_id unique), un second appel (double retour navigateur,
  // rafraîchissement de page) est silencieusement ignoré côté Postgres.
  await supabaseAdminRequest('/rest/v1/payments?on_conflict=stripe_event_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      stripe_event_id: `checkout_verify_${session.id}`,
      stripe_session_id: session.id,
      stripe_customer_id: session.customer || null,
      email,
      offer,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? null,
      status: 'paid',
      raw_event: session,
    })
  });
}

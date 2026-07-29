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
// Le schéma "subscribers" de production est indexé sur user_id (pas email) :
// Stripe ne connaissant que l'email du payeur, cette fonction retrouve (ou
// crée) le compte Supabase Auth correspondant via l'API admin avant d'écrire
// quoi que ce soit. Elle génère aussi un jeton "magic link" à usage unique
// pour que le navigateur du payeur obtienne une vraie session Supabase Auth
// tout de suite après paiement — la "connexion immédiate" du parcours.
//
// GET /.netlify/functions/verify-checkout-session?session_id=cs_...
//   → { activated: true, email, login_token }  si le paiement est confirmé
//   → { activated: false, ... }                sinon (jamais d'activation par défaut)

const { stripeRequest } = require('./_lib/stripe-rest');
const {
  supabaseAdminRequest,
  jsonResponse,
  ensureAuthUserForEmail,
  generateMagicLinkOtp,
} = require('./_lib/supabase-admin');

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

    let loginToken = null;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        loginToken = await activateSubscriber({ email, offer, session });
      } catch (e) {
        // Le paiement EST confirmé par Stripe à ce stade — on ne fait plus
        // jamais redescendre "activated" à false pour un souci d'écriture en
        // base : l'utilisateur a payé, il ne doit pas voir une erreur. On
        // journalise pour investigation manuelle plutôt que de bloquer.
        console.error('[verify-checkout-session] Échec activation (paiement confirmé quand même):', e);
      }
    } else {
      console.error('[verify-checkout-session] SUPABASE_SERVICE_ROLE_KEY absente — activation Stripe confirmée mais pas persistée en base.');
    }

    return jsonResponse(200, { activated: true, email, offer, login_token: loginToken });

  } catch (e) {
    console.error('[verify-checkout-session] NETWORK_ERROR', e);
    return jsonResponse(200, { activated: false, error: 'NETWORK_ERROR' });
  }
};

async function activateSubscriber({ email, offer, session }) {
  // Le compte Supabase Auth est censé déjà exister (créé côté client avant le
  // paiement) — mais s'il manque ou n'est pas confirmé, on ne bloque jamais
  // l'activation pour autant : on le crée/confirme ici, le paiement Stripe
  // étant une preuve d'identité largement suffisante.
  const user = await ensureAuthUserForEmail(email);

  // Upsert sur user_id (clé primaire de "subscribers" en production) — pas
  // sur email, colonne qui n'existe pas sur cette table.
  await supabaseAdminRequest('/rest/v1/subscribers?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: user.id,
      is_active: true,
      stripe_customer_id: session.customer || null,
      updated_at: new Date().toISOString(),
    })
  });

  // Idempotence : un même session_id ne déclenche qu'une seule écriture dans
  // "sales" (un second appel — double retour navigateur, F5 — est ignoré).
  const dedupeResp = await supabaseAdminRequest('/rest/v1/stripe_events_processed', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ event_id: `checkout_verify_${session.id}`, event_type: 'checkout_verify' })
  });
  const dedupeRows = dedupeResp.ok ? await dedupeResp.json() : [];
  if (Array.isArray(dedupeRows) && dedupeRows.length > 0) {
    await supabaseAdminRequest('/rest/v1/sales', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        stripe_session_id: session.id,
        stripe_customer_id: session.customer || null,
        buyer_user_id: user.id,
        product_id: offer || 'gc_67',
        product_name: 'Génération Capable — 67€/mois',
        amount: session.amount_total ?? 0,
        currency: session.currency || 'eur',
        status: 'completed',
        source: 'checkout_verify',
      })
    });
  }

  // Jeton de connexion immédiate — dégradé silencieusement en cas d'échec
  // (l'utilisateur pourra toujours se connecter avec son mot de passe).
  return generateMagicLinkOtp(email);
}

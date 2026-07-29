// netlify/functions/stripe-webhook.js
//
// Source de vérité pour tout ce qui arrive à un abonnement APRÈS le paiement
// initial : renouvellement, échec de paiement, annulation, remboursement.
// (Le déblocage immédiat post-paiement est géré par verify-checkout-session.js,
// qui ne couvre que le retour synchrone du navigateur.)
//
// Vérifie la signature Stripe (HMAC-SHA256 sur `${timestamp}.${rawBody}`,
// comparaison en temps constant) avant de faire confiance à quoi que ce
// soit dans le corps de la requête — n'importe qui peut poster un JSON qui
// RESSEMBLE à un événement Stripe sur cette URL publique, seule la
// signature prouve que ça vient réellement de Stripe.
//
// Pas de SDK Stripe (voir _lib/stripe-rest.js) : l'algorithme de signature
// est implémenté ici avec le module "crypto" natif de Node, documenté par
// Stripe : https://stripe.com/docs/webhooks#verify-manually
//
// Configuration Stripe Dashboard → Developers → Webhooks → Add endpoint :
//   URL      : https://generationcapable.fr/.netlify/functions/stripe-webhook
//   Events   : checkout.session.completed, customer.subscription.updated,
//              customer.subscription.deleted, invoice.payment_failed,
//              charge.refunded
//   → copier le "Signing secret" (whsec_...) dans STRIPE_WEBHOOK_SECRET (Netlify).

const crypto = require('crypto');
const { supabaseAdminRequest, jsonResponse, ensureAuthUserForEmail } = require('./_lib/supabase-admin');

const TOLERANCE_SECONDS = 5 * 60; // rejette les événements trop vieux (anti-rejeu)

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return { valid: false, reason: 'MISSING_SIGNATURE' };

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => {
      const [k, v] = p.split('=');
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return { valid: false, reason: 'MALFORMED_SIGNATURE' };

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return { valid: false, reason: 'TIMESTAMP_OUT_OF_TOLERANCE' };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(v1, 'hex');
  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return { valid: false, reason: 'SIGNATURE_MISMATCH' };
  }
  return { valid: true };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET absente sur Netlify — impossible de vérifier les événements.');
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  const signatureHeader = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const verification = verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!verification.valid) {
    console.error('[stripe-webhook] Signature invalide:', verification.reason);
    return jsonResponse(400, { error: 'INVALID_SIGNATURE' });
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (e) {
    return jsonResponse(400, { error: 'INVALID_JSON' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[stripe-webhook] SUPABASE_SERVICE_ROLE_KEY absente — événement signature-valide mais non traité.');
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  try {
    await recordAndProcess(stripeEvent);
    return jsonResponse(200, { received: true });
  } catch (e) {
    console.error('[stripe-webhook] Erreur de traitement', stripeEvent?.type, e);
    // 500 → Stripe réessaiera automatiquement cet événement plus tard.
    return jsonResponse(500, { error: 'PROCESSING_ERROR' });
  }
};

async function recordAndProcess(stripeEvent) {
  // Idempotence en tout premier : "stripe_events_processed" a une PK sur
  // event_id (l'id Stripe, globalement unique). Si cet événement a déjà été
  // traité (retry Stripe, double livraison), l'insert échoue en conflit et on
  // s'arrête là — aucun effet de bord n'est rejoué.
  const dedupeResp = await supabaseAdminRequest('/rest/v1/stripe_events_processed', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ event_id: stripeEvent.id, event_type: stripeEvent.type })
  });
  const dedupeRows = dedupeResp.ok ? await dedupeResp.json() : null;
  if (!Array.isArray(dedupeRows) || dedupeRows.length === 0) {
    console.log('[stripe-webhook] Événement déjà traité, ignoré:', stripeEvent.id, stripeEvent.type);
    return;
  }

  const obj = stripeEvent.data?.object || {};

  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const email = (obj.customer_details?.email || obj.customer_email || '').toLowerCase();
      const offer = obj.metadata?.offer || 'gc_67';
      if (email) {
        // Le schéma "subscribers" de production est indexé sur user_id, pas
        // email — Stripe ne connaissant que l'email du payeur, on retrouve
        // (ou crée) le compte Supabase Auth correspondant avant d'écrire.
        const user = await ensureAuthUserForEmail(email);
        await upsertSubscriberByUserId(user.id, {
          is_active: true,
          stripe_customer_id: obj.customer || null,
        });
        await supabaseAdminRequest('/rest/v1/sales', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            stripe_session_id: obj.id || null,
            stripe_customer_id: obj.customer || null,
            buyer_user_id: user.id,
            product_id: offer,
            product_name: 'Génération Capable — 67€/mois',
            amount: obj.amount_total ?? 0,
            currency: obj.currency || 'eur',
            status: 'completed',
            stripe_event_id: stripeEvent.id,
            source: 'stripe_webhook',
          })
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const active = ['active', 'trialing'].includes(obj.status);
      if (obj.customer) {
        await updateSubscriberByCustomerId(obj.customer, { is_active: active });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      if (obj.customer) {
        await updateSubscriberByCustomerId(obj.customer, { is_active: false });
      }
      break;
    }

    case 'invoice.payment_failed': {
      // On ne coupe pas l'accès sur un simple échec isolé (Stripe retente
      // automatiquement plusieurs fois — "dunning") : c'est
      // customer.subscription.updated qui déclenchera la désactivation si
      // Stripe finit par marquer l'abonnement past_due/unpaid/canceled.
      break;
    }

    case 'charge.refunded': {
      if (obj.customer) {
        await updateSubscriberByCustomerId(obj.customer, { is_active: false });
      }
      break;
    }

    default: {
      // Événement reçu mais non géré par cette intégration — déjà tracé dans
      // stripe_events_processed ci-dessus, rien de plus à faire.
    }
  }
}

async function upsertSubscriberByUserId(userId, fields) {
  await supabaseAdminRequest('/rest/v1/subscribers?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, ...fields, updated_at: new Date().toISOString() })
  });
}

async function updateSubscriberByCustomerId(stripeCustomerId, fields) {
  await supabaseAdminRequest(
    `/rest/v1/subscribers?stripe_customer_id=eq.${encodeURIComponent(stripeCustomerId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() })
    }
  );
}

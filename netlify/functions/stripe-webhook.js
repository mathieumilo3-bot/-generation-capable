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
//              charge.refunded, charge.dispute.created
//   → copier le "Signing secret" (whsec_...) dans STRIPE_WEBHOOK_SECRET (Netlify).
//
// Deux flux distincts partagent ce webhook, différenciés par la présence de
// metadata.order_id (posé uniquement par create-order-checkout-session.js) :
//   1. Abonnement Génération Capable 67€/mois (metadata.offer) — inchangé.
//   2. Commande CRM vendeur (metadata.order_id) — commande → sales → commission
//      → wallet. Le vendeur ne déclare jamais "payé" lui-même : c'est ici,
//      et seulement ici, que orders.status passe à 'paid'.

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
      if (obj.metadata?.order_id) {
        await handleOrderPaid(obj, stripeEvent);
        break;
      }

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
            stripe_payment_intent: obj.payment_intent || null,
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
      // Une commande CRM (paiement unique) et un abonnement (paiement
      // récurrent) peuvent tous deux être remboursés — on tente d'abord de
      // retrouver une commande via le payment_intent (obj.payment_intent
      // existe sur l'objet Charge), sinon on retombe sur le comportement
      // existant (désactivation d'abonnement par stripe_customer_id).
      const handledAsOrder = await handleOrderRefund(obj);
      if (!handledAsOrder && obj.customer) {
        await updateSubscriberByCustomerId(obj.customer, { is_active: false });
      }
      break;
    }

    case 'charge.dispute.created': {
      // Litige Stripe : on gèle la commission concernée (statut 'disputed',
      // exclue du solde disponible/en attente) plutôt que de la laisser
      // comptée normalement pendant l'instruction du litige. Résolution
      // manuelle par l'admin ensuite (hors automatisation Stripe : Stripe ne
      // notifie pas de façon fiable et automatisable une résolution positive).
      await freezeCommissionForDispute(obj);
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

// ── Commandes CRM : commande → vente → commission → wallet ──
//
// Le vendeur ne déclare jamais lui-même qu'une commande est payée
// (advance_prospect_stage() en base refuse explicitement l'étape "paid") :
// c'est cette fonction, déclenchée uniquement par un événement Stripe
// signé, qui fait foi.
async function handleOrderPaid(session, stripeEvent) {
  const orderId = session.metadata.order_id;

  const orderResp = await supabaseAdminRequest(
    `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,prospect_id,seller_user_id,product_type,price,commission_rate,status`
  );
  const orders = await orderResp.json();
  const order = Array.isArray(orders) ? orders[0] : null;
  if (!order) {
    console.error('[stripe-webhook] handleOrderPaid: commande introuvable', orderId);
    return;
  }
  if (order.status === 'paid') {
    // Déjà traité par un événement antérieur (ne devrait pas arriver grâce
    // à la déduplication sur stripeEvent.id, mais reste un garde-fou honnête).
    console.log('[stripe-webhook] handleOrderPaid: commande déjà payée, ignoré', orderId);
    return;
  }

  const productLabels = {
    site_internet: 'Site Internet', ia: 'Solution IA',
    generation_capable: 'Génération Capable', accompagnement: 'Accompagnement', autre: 'Prestation',
  };

  const saleResp = await supabaseAdminRequest('/rest/v1/sales', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      order_id: order.id,
      seller_user_id: order.seller_user_id,
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent || null,
      stripe_customer_id: session.customer || null,
      product_id: order.product_type,
      product_name: productLabels[order.product_type] || 'Prestation',
      amount: session.amount_total ?? order.price,
      currency: session.currency || 'eur',
      status: 'completed',
      stripe_event_id: stripeEvent.id,
      source: 'crm_order',
    })
  });
  const sales = await saleResp.json();
  const sale = Array.isArray(sales) ? sales[0] : null;
  if (!sale) {
    console.error('[stripe-webhook] handleOrderPaid: échec création de la vente pour la commande', orderId);
    return;
  }

  const commissionAmount = Math.round((session.amount_total ?? order.price) * order.commission_rate);
  await supabaseAdminRequest('/rest/v1/commissions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      sale_id: sale.id,
      order_id: order.id,
      seller_id: order.seller_user_id,
      amount: commissionAmount,
      percentage: order.commission_rate,
      status: 'pending',
      // 15 jours de délai avant maturation (voir get_my_wallet() : calculé
      // en direct depuis available_at, jamais un statut qu'un job devrait
      // faire progresser).
      available_at: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
    })
  });

  await supabaseAdminRequest(`/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'paid', updated_at: new Date().toISOString() })
  });

  const prospectResp = await supabaseAdminRequest(`/rest/v1/prospects?id=eq.${encodeURIComponent(order.prospect_id)}&select=stage`);
  const prospects = await prospectResp.json();
  const previousStage = prospects?.[0]?.stage || null;
  await supabaseAdminRequest(`/rest/v1/prospects?id=eq.${encodeURIComponent(order.prospect_id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ stage: 'paid', updated_at: new Date().toISOString() })
  });
  await supabaseAdminRequest('/rest/v1/prospect_stage_history', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      prospect_id: order.prospect_id,
      seller_user_id: order.seller_user_id,
      from_stage: previousStage,
      to_stage: 'paid',
      justification: 'Paiement confirmé automatiquement par Stripe',
    })
  });
}

// Remboursement d'une commande CRM : retrouve la vente via le
// payment_intent du Charge remboursé. Si aucune vente CRM ne correspond
// (ex: remboursement d'un abonnement), renvoie false pour laisser
// l'appelant traiter le cas abonnement existant.
async function handleOrderRefund(charge) {
  if (!charge.payment_intent) return false;

  const saleResp = await supabaseAdminRequest(
    `/rest/v1/sales?stripe_payment_intent=eq.${encodeURIComponent(charge.payment_intent)}&order_id=not.is.null&select=id,order_id`
  );
  const sales = await saleResp.json();
  const sale = Array.isArray(sales) ? sales[0] : null;
  if (!sale) return false;

  const commResp = await supabaseAdminRequest(`/rest/v1/commissions?sale_id=eq.${encodeURIComponent(sale.id)}&select=id,status,amount,seller_id,order_id`);
  const commissions = await commResp.json();

  for (const c of (commissions || [])) {
    if (c.status === 'pending') {
      // Pas encore versée (mûre ou non) : simple annulation, aucune dette.
      await supabaseAdminRequest(`/rest/v1/commissions?id=eq.${encodeURIComponent(c.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() })
      });
    } else if (c.status === 'withdrawn') {
      // Déjà versée au vendeur : dette qui sera déduite du prochain retrait,
      // jamais une réécriture silencieuse de la ligne historique déjà payée.
      await supabaseAdminRequest('/rest/v1/commissions', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          sale_id: sale.id, order_id: c.order_id, seller_id: c.seller_id,
          amount: -Math.abs(c.amount), percentage: 0, status: 'debt',
        })
      });
    }
  }

  await supabaseAdminRequest(`/rest/v1/orders?id=eq.${encodeURIComponent(sale.order_id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'refunded', updated_at: new Date().toISOString() })
  });

  return true;
}

async function freezeCommissionForDispute(charge) {
  if (!charge.payment_intent) return;
  const saleResp = await supabaseAdminRequest(
    `/rest/v1/sales?stripe_payment_intent=eq.${encodeURIComponent(charge.payment_intent)}&order_id=not.is.null&select=id`
  );
  const sales = await saleResp.json();
  const sale = Array.isArray(sales) ? sales[0] : null;
  if (!sale) return;

  await supabaseAdminRequest(`/rest/v1/commissions?sale_id=eq.${encodeURIComponent(sale.id)}&status=eq.pending`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'disputed', updated_at: new Date().toISOString() })
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
